"""Verify every durable part, including when a local assembled video exists."""
from pathlib import Path
import hashlib, json, gzip, subprocess
root=Path(__file__).resolve().parent.parent
folder=root/'art/kilo-v85/proofs'
index=json.loads((root/'art/kilo-v85/proof-index.json').read_text())
sha=lambda data:hashlib.sha256(data).hexdigest()
parts=0
for proof in index['proofs']:
    digest=hashlib.sha256();size=0
    for part in proof['storedParts']:
        data=(folder/part['file']).read_bytes()
        assert len(data)==part['bytes'] and len(data)<=4*1024*1024
        assert sha(data)==part['sha256']
        digest.update(data);size+=len(data);parts+=1
    assert size==proof['bytes'] and digest.hexdigest()==proof['videoSha256']
    metadata=(folder/proof['metadataStorage']).read_bytes() if proof.get('metadataStorage') else (folder/proof['metadata']).read_bytes()
    if proof.get('metadataStorage'):metadata=gzip.decompress(metadata)
    assert sha(metadata)==proof['metadataSha256']
    assert proof['sourceFingerprint']==index['sourceFingerprint']
    assert proof['proofHarnessFingerprint']==index['proofHarnessFingerprint']
changed=subprocess.check_output(['git','ls-files','--modified','--others','--exclude-standard','-z'],cwd=root).split(b'\0')
for file in set(changed)-{b''}:
    p=root/file.decode()
    if p.is_file():assert p.stat().st_size<=4*1024*1024, f'Oversized new repository object: {p}'
print(f'PASS {len(index["proofs"])} complete clips / {parts} durable parts; hashes and repository object limits verified.')
