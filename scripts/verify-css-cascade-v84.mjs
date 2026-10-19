/** Static analysis of the BUILT stylesheet for the four animation targets that
 * had concrete specificity collisions. Not a browser CSS/layout engine. */
import fs from 'node:fs';import assert from 'node:assert/strict';import postcss from 'postcss';
const file=fs.readdirSync('dist/assets').find(f=>/^review-.*\.css$/.test(f));assert(file);const css=fs.readFileSync('dist/assets/'+file,'utf8'),root=postcss.parse(css);
const split=s=>{const result=[];let from=0,depth=0;for(let i=0;i<s.length;i++){if(s[i]==='('||s[i]==='[')depth++;if(s[i]===')'||s[i]===']')depth--;if(s[i]===','&&!depth){result.push(s.slice(from,i));from=i+1;}}result.push(s.slice(from));return result;};
function specificity(s){
 s=s.replace(/:where\([^)]*\)/g,'');let extra=[0,0,0];
 s=s.replace(/:(?:is|not|has)\(([^()]*)\)/g,(_,inner)=>{const top=split(inner).map(specificity).sort(compare).at(-1);extra=extra.map((n,i)=>n+top[i]);return '';});
 const ids=(s.match(/#[\w-]+/g)||[]).length,attrs=(s.match(/\[[^\]]*\]/g)||[]).length,classes=(s.match(/\.[\w-]+/g)||[]).length;
 s=s.replace(/\[[^\]]*\]/g,'').replace(/#[\w-]+|\.[\w-]+/g,'');
 const elements=(s.match(/::[\w-]+/g)||[]).length;s=s.replace(/::[\w-]+/g,'');const pseudos=(s.match(/:[\w-]+(?:\([^)]*\))?/g)||[]).length;s=s.replace(/:[\w-]+(?:\([^)]*\))?/g,'');
 const types=(s.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g)||[]).length;
 return[extra[0]+ids,extra[1]+attrs+classes+pseudos,extra[2]+elements+types];
}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return 0;}
const declarations=[];let order=0;
root.walkRules(rule=>{const parents=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')parents.push([p.name,p.params]);if(parents.some(([name])=>/keyframes/.test(name)))return;
 for(const selector of split(rule.selector))for(const decl of rule.nodes)if(decl.type==='decl'&&decl.prop==='animation')declarations.push({selector:selector.trim(),value:decl.value,important:!!decl.important,specificity:specificity(selector),order:order++,parents});});
function match(d,target,localReduced,prefReduced){const s=d.selector;
 if(d.parents.some(([name,value])=>name==='media'&&(/prefers-reduced-motion:reduce/.test(value)!==prefReduced)&&/prefers-reduced-motion/.test(value)))return false;
 if(/\[data-reduced=["']?false/.test(s)&&localReduced)return false;
 if(/\[data-reduced=["']?(?:true|1)/.test(s)&&!localReduced)return false;
 if(target==='card')return /\.kf-card(?::nth-child\(2\))?$/.test(s)&&!s.includes('.kf-card ');
 if(target==='rail')return s.includes('.kk-reel-completion')&&/\sstrong$/.test(s);
 if(target==='full')return s.includes('.ks-completion')&&s.includes('.ks-completion-award')&&/strong$/.test(s);
 return s.includes('.ks-loading-logo')&&/\.ks-loading-logo$/.test(s);
}
const results=[];
for(const target of ['card','rail','full','logo'])for(const [localReduced,prefReduced]of[[false,false],[true,false],[false,true],[true,true]]){
 const candidates=declarations.filter(d=>match(d,target,localReduced,prefReduced)).sort((a,b)=>Number(a.important)-Number(b.important)||compare(a.specificity,b.specificity)||a.order-b.order),winner=candidates.at(-1),value=winner?.value??'none';
 const expected=localReduced||prefReduced?'none':({card:'kf-impact-arrive',rail:'kk-result-ink',full:'kk-result-ink',logo:'kk-logo-commit'}[target]);
 assert(value.split(/\s+/).includes(expected),`${target} reduced=${localReduced}/${prefReduced}: ${value}, expected ${expected}`);
 results.push({target,localReduced,prefReduced,resolvedAnimation:value,winner:winner?.selector??'CSS initial value',specificity:winner?.specificity});
}
fs.writeFileSync('art/kilo-v84/verification/css-cascade.json',JSON.stringify({method:'Static relevant-selector/cascade analysis of production CSS. Actual classes/attributes from retained markup; not browser paint or layout verification.',file,results},null,2)+'\n');
console.log('PASS 16 built-CSS cascade cases: card / completion / loading choreography and reduced motion.');
