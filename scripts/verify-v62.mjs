import {execFileSync} from 'node:child_process';
const tasks=[
 ['verify-vs-preserved-v62.mjs'],
 ['verify-reel-renderer-v56.mjs'],
 ['verify-max-performance-v62.mjs'],
 ['verify-max-mode-v59.mjs'],
 ['verify-boat-boundaries-v62.mjs'],
 ['verify-reel-ui-v62.mjs'],
 ['verify-collection-v62.mjs','--authored','--features-v51'],
 ['verify-stage-performance-v62.mjs'],
 ['verify-audio-v54.mjs'],
];
for(const [script,...args]of tasks)execFileSync(process.execPath,[`scripts/${script}`,...args],{
 stdio:'inherit',env:{...process.env,KILO_VERIFICATION_DIR:'art/kilo-v62',KILO_FEATURE_REPLAY_FILE:'art/kilo-v60/replay-examples.json'},
});
