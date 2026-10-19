#!/usr/bin/env python3
"""Restore the exact Kilo King v85 checkpoint using only Python's standard library."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, os, tarfile, tempfile

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=Path('restored'),help='Destination parent; Kilo-King-v85 must not already exist.')
args=parser.parse_args()
here=Path(__file__).resolve().parent
manifest=json.loads((here/'manifest.json').read_text())
destination=args.output.resolve()
target=destination/'Kilo-King-v85'
if target.exists(): raise SystemExit(f'Refusing to overwrite {target}. Choose a new --output directory.')
destination.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='.kilo-v85-',dir=destination) as temporary:
    temporary=Path(temporary)
    archive=temporary/'source.tar.gz'
    combined=hashlib.sha256()
    with archive.open('wb') as output:
        for part in manifest['parts']:
            path=here/part['file']; digest=hashlib.sha256(); size=0
            with path.open('rb') as source:
                while block:=source.read(1024*1024):
                    digest.update(block);combined.update(block);output.write(block);size+=len(block)
            if size!=part['bytes'] or digest.hexdigest()!=part['sha256']:
                raise SystemExit(f'Checksum mismatch: {path}')
    if combined.hexdigest()!=manifest['archiveSha256']: raise SystemExit('Archive checksum mismatch')
    expected={'Kilo-King-v85/'+item['path']:item for item in manifest['files']}
    seen=set()
    with tarfile.open(archive,'r:gz') as tar:
        for member in tar:
            name=PurePosixPath(member.name)
            if member.name not in expected or member.name in seen or not member.isfile() or name.is_absolute() or '..' in name.parts:
                raise SystemExit(f'Unexpected archive member: {member.name}')
            data=tar.extractfile(member).read();item=expected[member.name]
            if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:
                raise SystemExit(f'File checksum mismatch: {member.name}')
            path=temporary/member.name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
            path.chmod(member.mode & 0o777);seen.add(member.name)
    if seen!=set(expected): raise SystemExit('Archive is incomplete')
    os.rename(temporary/'Kilo-King-v85',target)
print(f'Restored {manifest["version"]} ({manifest["sourceCommit"]}) to {target}')
print('Run: cd '+str(target)+' && npm ci && npm run build')
print('Restore proof movies: python3 scripts/reassemble-v85-proofs.py')
