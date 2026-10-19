"""Restore verified original proof files from private source; no transcoding."""
from pathlib import Path
import hashlib, json, gzip, os
root=Path(__file__).resolve().parent.parent
proofs=root/'art/kilo-v83/proofs'
index=json.loads((root/'art/kilo-v83/proof-index.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
for entry in index['proofs']:
    metadata=proofs/entry['metadata']
    if entry.get('metadataStorage'):
        raw=gzip.decompress((proofs/entry['metadataStorage']).read_bytes())
        assert sha(raw)==entry['metadataSha256'];metadata.write_bytes(raw)
    assert sha(metadata.read_bytes())==entry['metadataSha256']
    out=proofs/entry['file']
    if out.exists() and sha(out.read_bytes())==entry['videoSha256']:
        print('Verified',out.name);continue
    tmp=out.with_suffix('.restore.tmp');digest=hashlib.sha256()
    try:
        with tmp.open('wb') as stream:
            for part in entry['storedParts']:
                raw=(proofs/part['file']).read_bytes()
                assert len(raw)==part['bytes'] and sha(raw)==part['sha256']
                digest.update(raw);stream.write(raw)
            stream.flush();os.fsync(stream.fileno())
        assert digest.hexdigest()==entry['videoSha256']
        tmp.replace(out)
    finally:tmp.unlink(missing_ok=True)
    print('Restored',out.name)
