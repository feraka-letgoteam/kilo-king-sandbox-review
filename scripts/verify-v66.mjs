import {execFileSync} from 'node:child_process';
for(const script of ['verify-max-stage-v66.mjs','verify-max-physical-v66.mjs','verify-max-bridge-v65.mjs','verify-max-performance-v62.mjs','verify-boat-performance-v63.mjs','verify-character-performance-v63.mjs']) {
 execFileSync(process.execPath,[`scripts/${script}`],{stdio:'inherit',env:{...process.env,KILO_VERIFICATION_DIR:'art/kilo-v66/history-checks'}});
}
