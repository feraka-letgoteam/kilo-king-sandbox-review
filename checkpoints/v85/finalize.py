"""One-time, checksum-verified restore into the existing GitHub history."""
from pathlib import Path, PurePosixPath
import hashlib, json, os, shutil, subprocess

root=Path.cwd()
checkpoint=root/'checkpoints/v85'
manifest=json.loads((checkpoint/'manifest.json').read_text())
assert manifest['sourceCommit']=='7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab'
assert os.environ['GITHUB_REPOSITORY']=='feraka-letgoteam/kilo-king-sandbox-review'
assert os.environ['GITHUB_REF']=='refs/heads/main'
expected_head=os.environ['GITHUB_SHA']
def git(*args,**kwargs):
    return subprocess.check_output(['git',*args],**kwargs).decode().strip()
assert git('rev-parse','HEAD')==expected_head
destination=Path(os.environ['RUNNER_TEMP'])/'kilo-v85-restored'
subprocess.run(['python3',str(checkpoint/'restore.py'),'--output',str(destination)],check=True)
source=destination/'Kilo-King-v85'
for entry in manifest['files']:
    p=PurePosixPath(entry['path'])
    assert not p.is_absolute() and '..' not in p.parts
    data=(source/entry['path']).read_bytes()
    assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
# Reject a moving main branch. No force pushes or history replacement.
git('fetch','origin','main')
assert git('rev-parse','origin/main')==expected_head, 'main changed during upload; stopping without overwriting it'
git('rm','-r','--ignore-unmatch','--','.')
for entry in manifest['files']:
    dest=root/entry['path'];dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source/entry['path'],dest)
record={k:v for k,v in manifest.items() if k!='parts'}
record['githubImportParent']=expected_head
record['previewUrl']='https://kilo-king-review.navymap4.chatgpt.site'
(root/'SOURCE-CHECKPOINT-V85.json').write_text(json.dumps(record,indent=2)+'\n')
(root/'V85-GITHUB-CHECKPOINT.md').write_text('''# Kilo King v85\n\nThis branch contains the source and runtime assets for the deployed private v85 preview.\n\n- Original source commit: `7e6105e6975e6a6a9128eb4f0f13d13d41bf3bab`\n- Application, public assets, configuration and scripts are preserved byte for byte.\n- Current proof clips, proof metadata and verification reports are included.\n- Earlier offline art/proof archives and duplicate still frames remain in the private Sites source repository.\n- `SOURCE-CHECKPOINT-V85.json` records every imported file and its SHA-256.\n\n## Run\n\n```sh\nnpm ci\nnpm run build\nnpm run dev:review\n```\n\n## Proof movies\n\n```sh\npython3 scripts/reassemble-v85-proofs.py\n```\n\nThe 19 clips are stored as exact binary parts under `art/kilo-v85/proofs/`. Reassembly does not transcode. See `art/kilo-v85/README.md` for the change notes and verification limits. The movies are offline production-controller captures, not live browser/GPU evidence.\n\nThis import changes no game code, math, wallet, controls or layout. It does not deploy anything. The previous GitHub source remains available in this branch's history.\n''')
paths=[e['path'] for e in manifest['files']]+['SOURCE-CHECKPOINT-V85.json','V85-GITHUB-CHECKPOINT.md']
subprocess.run(['git','add','--force','--pathspec-from-file=-','--pathspec-file-nul'],input=('\0'.join(paths)+'\0').encode(),check=True)
for entry in manifest['files']:
    expected=hashlib.sha1(f"blob {entry['bytes']}\0".encode()+(root/entry['path']).read_bytes()).hexdigest()
    assert git('rev-parse',':'+entry['path'])==expected, entry['path']
git('config','user.name','github-actions[bot]')
git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
git('commit','-m','Restore complete Kilo King v85 source, assets and motion proofs')
git('push','origin','HEAD:main')
final=git('rev-parse','HEAD')
print('Verified v85 source restored to main:',final)
with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as summary:
    summary.write(f'Imported {len(manifest["files"])} verified files. Commit: `{final}`. No deployment.\n')
