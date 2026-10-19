import {execFileSync} from 'node:child_process';
const tasks=[
 ['verify-feature-pacing-v60.mjs'],
 ['verify-reel-features-v54.mjs'],
 ['verify-reel-renderer-v56.mjs'],
 ['verify-v59-contracts.mjs'],
 ['verify-max-mode-v59.mjs'],
 ['verify-reel-ui-v58.mjs'],
 ['verify-collection-v55.mjs','--authored','--features-v51'],
];
for(const [script,...args]of tasks)execFileSync(process.execPath,[`scripts/${script}`,...args],{
 stdio:'inherit',env:{...process.env,KILO_VERIFICATION_DIR:'art/kilo-v60',KILO_FEATURE_REPLAY_FILE:'art/kilo-v60/replay-examples.json'},
});
