"""Validate final clips and preserve exact bytes in repository-sized objects."""
from pathlib import Path
import hashlib, json, gzip, subprocess

root = Path(__file__).resolve().parent.parent
proofs = root / 'art/kilo-v87/proofs'
stems = ['base-hit-1440x900', 'base-hit-390x844', 'vs-pair-1440x900', 'vs-pair-390x844', 'vs-wide-1440x900', 'god-full-1440x900', 'god-full-390x844', 'god-early-loss-1440x900', 'god-late-overshoot-1440x900', 'collection-390x844', 'entry-vs-1440x900', 'entry-vs-390x844', 'entry-dock-390x844', 'ordinary-1440x900', 'session-vs-390x844']
sha = lambda b: hashlib.sha256(b).hexdigest()
index = {'version':'v87','method':'Native Canvas rendering of production controllers; offline audio mix, not live browser/GPU/complete React UI.', 'proofs':[]}
fingerprints = set()
harnesses = set()
ignored = ['\n## v87 generated proof intermediates; final bytes are stored as verified parts.\n',
           '/art/kilo-v87/proofs/*.mp4\n','/art/kilo-v87/proofs/.*.mp4.*\n',
           '/art/kilo-v87/proofs/*.audio.f32\n','/art/kilo-v87/qa/\n','/art/kilo-v87/qa2/\n','/art/kilo-v87/qa3/\n','/art/kilo-v87/proofs/*.log\n']
for stem in stems:
    metadata = proofs / (stem+'.json')
    data = json.loads(metadata.read_text())
    assert not data.get('metadataReplay'), 'Final v87 clips must be rasterized directly from the final source'
    assert data['capture']['fps'] in (15,30), 'Declare the actual proof sampling rate'
    data['method'] = data['method'].replace('verify-stage-mount-v81.mjs', 'verify-stage-mount-v87.mjs')
    metadata.write_text(json.dumps(data,indent=2)+'\n')
    fingerprints.add(data['sourceFingerprint'])
    assert data.get('proofHarnessFingerprint'), 'Recapture with the corrected mesh painter'
    harnesses.add(data['proofHarnessFingerprint'])
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
        'sourceFingerprint':data['sourceFingerprint'],'proofHarnessFingerprint':data['proofHarnessFingerprint'],'metadata':metadata.name,'metadataSha256':sha(metadata_raw),
        'metadataStorage':metadata_storage,'storedParts':parts,'finalWin':data['finalWin'],
        'selection':'unselected predeclared stream' if stem.startswith('ordinary') or stem.startswith('session-dock') else 'selected recorded acceptance example'})
assert len(fingerprints)==1,'All final proof controllers must match the final source'
current=subprocess.check_output(['node','--input-type=module','-e',"import {sourceFingerprint} from './scripts/v79-source-fingerprint.mjs';console.log(sourceFingerprint())"],cwd=root,text=True).strip()
assert fingerprints=={current}, 'Proofs must match current production source'
assert len(harnesses)==1, 'All proof pixels must use one corrected capture harness'
expected_harness = sha(b''.join(f.encode()+b'\0'+(root/f).read_bytes() for f in ['scripts/render-overhaul-v87.mjs','scripts/offline-runtime-v79.mjs','scripts/offline-pixi-painter.mjs','scripts/offline-chrome-v80.mjs']))
assert harnesses == {expected_harness}, 'Final proof painter changed; recapture'
index['sourceFingerprint'] = next(iter(fingerprints))
index['proofHarnessFingerprint'] = next(iter(harnesses))
(root/'art/kilo-v87/proof-index.json').write_text(json.dumps(index,indent=2)+'\n')
ignore = root/'.gitignore'; text=ignore.read_text()
for line in ignored:
    if line.strip() not in text: text+=line
ignore.write_text(text)
print(f'Preserved {len(stems)} validated audiovisual proofs, source {index["sourceFingerprint"]}')
