"""Validate one frozen production build against its native offline clips."""
from pathlib import Path
import json, hashlib, subprocess

root=Path('art/kilo-v77/proofs')
expected=['god-full-1440x900','god-full-390x844','god-early-loss-1440x900','god-early-loss-390x844','god-late-overshoot-1440x900','god-late-overshoot-390x844','vs-five-1440x900','vs-five-390x844']
fingerprint=subprocess.check_output(['node','--input-type=module','-e','import {sourceFingerprint} from "./scripts/v77-source-fingerprint.mjs";console.log(sourceFingerprint());'],text=True).strip()
checks=[]
for identifier in expected:
    data=json.loads((root/(identifier+'.json')).read_text())
    assert data['sourceFingerprint']==fingerprint,(identifier,'source changed')
    clip=root/(identifier+'.mp4')
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',str(clip)],text=True))['streams'][0]
    assert [probe['width'],probe['height']]==data['viewport']
    assert probe['r_frame_rate']=='30/1'
    assert int(probe['nb_frames'])==data['frames']
    rows=data['telemetry']
    assert data['finalWin']-data['fixture']['previousTotal']==data['fixture']['event']['credited']
    assert [c['value'] for c in data['credits']]==[b['value'] for b in data['bankEvents']]
    assert all(len(r['stripVisibility'])==5 for r in rows)
    if identifier.startswith('god'):
        assert data['normalSpinCalls']==1
        assert any(r['isSpinning'] and any(abs(y)>1 for y in r['stripOffsets']) for r in rows)
        assert all(all(r['stripVisibility']) and all(n>=3 for n in r['stripCellCounts']) for r in rows)
        cards=[r['card'] for r in rows if r.get('card')]
        assert min(c['pitch'] for c in cards)<-.08
        assert min(c['lean'] for c in cards)<-.15
        assert max(c['wake'] for c in cards)>.7
        assert any(c['phase']=='anticipate' and c['wake']>.35 for c in cards)
        assert any(c['phase']=='anticipate' and abs(c['pitch'])<.001 for c in cards)
        results=[c for c in cards if c['phase']=='result']
        assert results and all(abs(c['pitch'])<.001 and abs(c['lean'])<.001 and c['wake']==0 for c in results)
        if 'full' in identifier:
            assert any(c['segment']==5 and abs(c['offset'])<.001 for c in results)
            assert len(data['credits'])==1
            assert any(r['kind']=='max-stop' for r in data['reactions'])
        else:
            assert not data['credits']
            if 'late' in identifier:
                misses=[c for c in cards if c['phase']=='overshoot']
                assert misses and max(c['segment'] for c in misses)>5.8
                assert any(c['wake']>.7 for c in misses)
            else:
                assert all(abs(c['segment']-2)<.001 for c in results)
    else:
        assert any(c['name']=='vsReady' for c in data['cues'])
        assert any(c['name']=='vsImpact' for c in data['cues'])
        assert any(c['name']=='vsLock' for c in data['cues'])
        for row in rows:
            for group in row['groups']:
                assert all(row['stripVisibility'][reel] is False for reel in group['reels'])
        if 'five' in identifier:
            assert any(len(g['reels'])==5 for r in rows for g in r['groups'])
            assert max(n['scale'] for r in rows for g in r['groups'] for n in g['number'])>1.17
            assert len(data['credits'])==1
            assert data['finalWin']==18000000
    checks.append({'id':identifier,'frames':data['frames'],'duration':float(probe['duration']),'bytes':clip.stat().st_size,'sha256':hashlib.sha256(clip.read_bytes()).hexdigest(),'credits':data['credits']})

verification=json.loads(Path('art/kilo-v77/verification.json').read_text())
assert verification['sourceFingerprint']==fingerprint
(root/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
gallery=json.loads((root/'VS-art-gallery.json').read_text())
assert gallery['sourceFingerprint']==fingerprint
assert len(gallery['entries'])==20
assert all(x['font']=='VS Display' and x['inkWidth']<=x['pixels'][0] for x in gallery['entries'])
index={'version':'v77','sourceFingerprint':fingerprint,'method':'Silent native CPU Canvas rasterization of actual production Pixi scene/controllers. WIN display harness. Not live browser/WebGL proof.','clips':checks,'verification':'verification.json','gallery':'VS-art-gallery.json'}
(root/'final-manifest.json').write_text(json.dumps(index,indent=2)+'\n')
print(f"PASS {len(checks)} native clips from frozen build {fingerprint}")
