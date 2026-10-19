import {execFileSync} from 'node:child_process';
for(const script of ['verify-feature-environments-v64.mjs','verify-v63.mjs']) {
  execFileSync(process.execPath,[`scripts/${script}`],{stdio:'inherit'});
}
