"""Restore exact offline MP4 proofs from repository-sized parts; no transcoding."""
from pathlib import Path
import hashlib
import json
import os

root = Path(__file__).resolve().parent.parent
index = json.loads((root / 'art/kilo-v82/proof-index.json').read_text())
proofs = root / 'art/kilo-v82/proofs'
for proof in index['proofs']:
    output = proofs / proof['file']
    if output.exists() and hashlib.sha256(output.read_bytes()).hexdigest() == proof['videoSha256']:
        print(f'Verified {output.name}')
        continue
    parts = proof.get('storedParts')
    if not parts:
        raise RuntimeError(f'Missing or invalid proof: {output.name}')
    temporary = output.with_suffix('.restore.tmp')
    digest = hashlib.sha256()
    try:
        with temporary.open('wb') as stream:
            for part in parts:
                payload = (proofs / part['file']).read_bytes()
                if len(payload) != part['bytes'] or hashlib.sha256(payload).hexdigest() != part['sha256']:
                    raise RuntimeError(f'Invalid proof part: {part["file"]}')
                digest.update(payload)
                stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        if digest.hexdigest() != proof['videoSha256']:
            raise RuntimeError(f'Invalid assembled proof: {output.name}')
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Restored {output.name}')
