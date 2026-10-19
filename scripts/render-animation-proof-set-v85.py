"""Two bounded offline capture workers. No server/browser or deployment."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import os, subprocess
cases = [
('base-hit','1440x900'),('base-hit','390x844'),
('vs-wide','1440x900'),('vs-wide','390x844'),('vs-five','390x844'),
('god-full','1440x900'),('god-full','390x844'),('god-early-loss','1440x900'),('god-late-overshoot','1440x900'),
('collection','1440x900'),('collection','390x844'),
('catch-win','390x844'),('entry-dock','390x844'),('entry-vs','1440x900'),
('retrigger','390x844'),('tool-hook','390x844'),('tool-dynamite','390x844'),
('ordinary','1440x900'),('dock-progression','390x844')]
out=Path('art/kilo-v85/proofs');out.mkdir(parents=True,exist_ok=True)
def render(case):
 name,size=case;env=os.environ|{'KILO_PROOF_CASE':name,'KILO_PROOF_SIZE':size,'KILO_PROOF_SESSION_MS':'45000','KILO_PROOF_OUTPUT':str(out),'KILO_PROOF_REUSE':'1'}
 log=out/(name+'-'+size+'.log')
 with log.open('w') as stream:
  subprocess.run(['node','--expose-gc','scripts/render-performance-proofs-v85.mjs'],env=env,stdout=stream,stderr=subprocess.STDOUT,check=True)
  subprocess.run(['python','scripts/mix-proof-audio-v83.py',str(out/(name+'-'+size+'.json'))],stdout=stream,stderr=subprocess.STDOUT,check=True)
 return name+'-'+size
with ThreadPoolExecutor(max_workers=2) as workers:
 for result in as_completed([workers.submit(render,c) for c in cases]):
  print('Captured',result.result(),flush=True)
print('All19 source-owned audiovisual proof sequences complete.',flush=True)
