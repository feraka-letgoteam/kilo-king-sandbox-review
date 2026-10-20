/** A single clock for token, confrontation, contender factors and locked wild.
 * These curves only display the recorded winner; they never select one. */
const unit=(n:number)=>Math.max(0,Math.min(1,n));
const s=(n:number)=>{const t=unit(n);return t*t*(3-2*t);};
export function vsArenaAt(t:number,reduced=false){
  if(reduced)return {openX:1,openY:1,arrival:1,resolve:1,factorTravel:1,counter:0,finish:0,pressure:1};
  const arrival=s(t/.18),counter=Math.sin(Math.PI*unit((t-.535)/.10)),finish=Math.sin(Math.PI*unit((t-.62)/.10));
  return {arrival,openX:.035+.965*s((t-.055)/.125),openY:.035+.965*s(t/.105),
    resolve:s((t-.72)/.18),factorTravel:s((t-.80)/.14),counter,finish,
    pressure:.10*s((t-.36)/.13)-.075*counter+.18*finish};
}
/** Short separate lanes lead into one total, without serially delaying every line. */
export function connectionClock(lineCount:number,large=false){
  const lanes=Math.min(3,Math.max(1,lineCount));
  return {trace:lanes===1?220:300+(lanes-1)*115,read:lanes===1?0:170,
    reveal:210,hold:large?420:260};
}
