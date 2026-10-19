"""Validate final clips and preserve exact bytes in repository-sized objects."""
from pathlib import Path
import hashlib, json, gzip, subprocess

root = Path(__file__).resolve().parent.parent
proofs = root / 'art/kilo-v83/proofs'
stems = ['ordinary-1440x900','ordinary-390x844','catch-win-1440x900','catch-win-390x844',
         'catch-miss-390x844','session-dock-390x844','dock-progression-1440x900',
         'vs-wide-1440x900','vs-wide-390x844','collection-390x844']
sha = lambda b: hashlib.sha256(b).hexdigest()
index = {'version':'v83','method':'Native Canvas rendering of production controllers; offline audio mix, not live browser/GPU/complete React UI.', 'proofs':[]}
fingerprints = set()
ignored = ['\n## v83 generated proof intermediates; final bytes are stored as verified parts.\n',
           '/art/kilo-v83/proofs/*.mp4\n','/art/kilo-v83/proofs/.*.mp4.*\n',
           '/art/kilo-v83/proofs/*.audio.f32\n']
for stem in stems:
    metadata = proofs / (stem+'.json')
    data = json.loads(metadata.read_text())
    fingerprints.add(data['sourceFingerprint'])
    video = proofs / data['audioProof']['file']
    raw = video.read_bytes()
    streams = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries',
        'stream=codec_type,width,height,nb_frames,r_frame_rate','-of','json',str(video)]))['streams']
    visual = next(s for s in streams if s['codec_type']=='video')
    assert any(s['codec_type']=='audio' for s in streams)
    assert [visual['width'],visual['height']] == data['viewport']
    assert int(visual['nb_frames']) == data['capture']['frames']
    assert all((proofs/frame['file']).is_file() for frame in data['snapshots'])
    part_dir = proofs / (video.name+'.parts'); part_dir.mkdir(exist_ok=True)
    for old in part_dir.glob('part-*.bin'): old.unlink()
    parts = []
    for n,start in enumerate(range(0,len(raw),4*1024*1024)):
        payload = raw[start:start+4*1024*1024]
        part = part_dir / f'part-{n:03}.bin'; part.write_bytes(payload)
        parts.append({'file':str(part.relative_to(proofs)),'bytes':len(payload),'sha256':sha(payload)})
    metadata_raw = metadata.read_bytes()
    metadata_storage = None
    if len(metadata_raw)>4*1024*1024:
        compressed = metadata.with_suffix('.json.gz');compressed.write_bytes(gzip.compress(metadata_raw,mtime=0))
        metadata_storage = compressed.name
        ignored.append('/'+str(metadata.relative_to(root))+'\n')
    index['proofs'].append({'id':stem,'file':video.name,'videoSha256':sha(raw),'bytes':len(raw),
        'viewport':data['viewport'],'durationMs':data['durationMs'],'capture':data['capture'],
        'sourceFingerprint':data['sourceFingerprint'],'metadata':metadata.name,'metadataSha256':sha(metadata_raw),
        'metadataStorage':metadata_storage,'storedParts':parts,'finalWin':data['finalWin'],
        'selection':'unselected predeclared stream' if stem.startswith('ordinary') or stem.startswith('session-dock') else 'selected recorded acceptance example'})
assert len(fingerprints)==1,'All final proof controllers must match the final source'
index['sourceFingerprint'] = next(iter(fingerprints))
(root/'art/kilo-v83/proof-index.json').write_text(json.dumps(index,indent=2)+'\n')
ignore = root/'.gitignore'; text=ignore.read_text()
for line in ignored:
    if line.strip() not in text: text+=line
ignore.write_text(text)
print(f'Preserved {len(stems)} validated audiovisual proofs, source {index["sourceFingerprint"]}')
