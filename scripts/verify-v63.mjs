import {execFileSync} from 'node:child_process';
for(const script of ['verify-character-performance-v63.mjs','verify-physical-continuity-v63.mjs','verify-vs-performance-v63.mjs','verify-boat-performance-v63.mjs','verify-max-performance-v62.mjs']){
 execFileSync(process.execPath,[`scripts/${script}`],{stdio:'inherit',env:{...process.env,KILO_VERIFICATION_DIR:'art/kilo-v63'}});
}
