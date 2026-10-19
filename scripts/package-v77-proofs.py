"""Package the validated eight clips without redundant intermediate frames."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path('art/kilo-v77/proofs')
manifest = json.loads((root / 'final-manifest.json').read_text())
gallery = json.loads((root / 'VS-art-gallery.json').read_text())
assert len(manifest['clips']) == 8
assert len(gallery['entries']) == 20
names = ['README.md', 'index.html', 'final-manifest.json', 'verification.json', 'VS-art-gallery.json']
for clip in manifest['clips']:
    identifier = clip['id']
    names += [identifier + '.mp4', identifier + '.json', identifier + '-sequence.webp']
names += [entry['file'] for entry in gallery['entries']]
assert len(names) == len(set(names))
content = {}
for name in names:
    data = (root / name).read_bytes()
    content[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
for clip in manifest['clips']:
    actual = content[clip['id'] + '.mp4']
    assert actual['sha256'] == clip['sha256']
    assert actual['bytes'] == clip['bytes']
archive_contents = {'sourceFingerprint': manifest['sourceFingerprint'], 'files': content}
out = Path('/workspace/scratch/6281bb86619d/deliverables/kilo-v77/Kilo-King-v77-Offline-Proofs.zip')
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w') as archive:
    for name in names:
        compression = zipfile.ZIP_STORED if name.endswith(('.mp4', '.webp')) else zipfile.ZIP_DEFLATED
        archive.write(root / name, name, compress_type=compression, compresslevel=6)
    archive.writestr('ARCHIVE-CONTENTS.json', json.dumps(archive_contents, indent=2) + '\n', compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(names + ['ARCHIVE-CONTENTS.json'])
    for name, item in content.items():
        data = archive.read(name)
        assert len(data) == item['bytes']
        assert hashlib.sha256(data).hexdigest() == item['sha256']
summary = {'file': str(out), 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'entries': len(names) + 1, 'clips': 8, 'galleryEntries': 20, 'sourceFingerprint': manifest['sourceFingerprint'], 'validation': 'CRC plus byte count and SHA-256 of every included source file; all eight native MP4 hashes match final-manifest.json.'}
(out.parent / 'proof-package.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
