/** The collector rail is presentation only. Its boxes stay inside the existing
 * header allocation; socket addresses are retained for the recorded flights. */
export type DocksideHeaderState = {
  left: number; mult: number; filled: number; holding: boolean; maxed: boolean;
  nextSpins?: number | null; nextMult?: number | null; capped?: boolean;
};
export function docksideHeaderLayout(reelWidth: number, header: number, portrait: boolean) {
  const width = Math.min(520, Math.max(260, reelWidth - 12));
  const height = portrait ? 50 : Math.min(38, header);
  const top = portrait ? header - height - 18 : 0;
  const socket = portrait ? 30 : 28, gap = portrait ? 7 : 10;
  const track = socket * 4 + gap * 3;
  const start = (width - track) / 2;
  return { width, height, top, socket, gap, start,
    statWidth: Math.min(108, Math.max(58, start - 10)),
    sockets: Array.from({length:4},(_,i)=>({x:start+i*(socket+gap),y:0,w:socket,h:socket})) };
}
const escape = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function docksideHeaderPaint(state: DocksideHeaderState, layout: ReturnType<typeof docksideHeaderLayout>, id: string,
  portraitUrl = '/kilo-v79/characters/collector-idle.webp') {
  const {width:w,height:h,statWidth:s,socket:d,sockets}=layout;
  const reward = state.capped ? 'MAX WIN REACHED' : state.maxed || state.nextMult == null
    ? 'MAX COLLECTOR LEVEL' : `Next: +${state.nextSpins ?? 10} spins · ×${state.nextMult}`;
  const plate = (x:number) => `<path d="M${x+5} 1H${x+s-5}l5 5v${h-13}l-5 5H${x+5}l-5-5V6Z" fill="#0d2731" stroke="#597271" stroke-width="1"/>`;
  const stat = (x:number,label:string,value:string,testid?:string) => `${plate(x)}<text x="${x+s/2}" y="11" font-size="9" font-weight="600" fill="#bacbc2" letter-spacing=".8" text-anchor="middle">${label}</text><text ${testid?`data-testid="${testid}"`:''} x="${x+s/2}" y="${h-7}" font-size="${h>40?28:23}" font-weight="700" text-anchor="middle" fill="#fff1bb">${escape(value)}</text>`;
  return `<g font-family="Source Sans 3, sans-serif" style="font-variant-numeric:tabular-nums">${stat(0,'SPINS',String(state.left),'spins-left')}${stat(w-s,'COLLECT',`×${state.mult}`)}
    <path d="M${sockets[0]!.x+d/2} ${d/2}H${sockets[3]!.x+d/2}" stroke="#0b1c26" stroke-width="5"/><path d="M${sockets[0]!.x+d/2} ${d/2}H${sockets[3]!.x+d/2}" stroke="#99845a" stroke-width="1.5"/>
    ${sockets.map((p,i)=>{const filled=i<state.filled, next=!state.maxed&&!state.holding&&i===state.filled;return `<g data-socket="${i}" class="dock-socket" data-filled="${filled}" data-next="${next}" transform="translate(${p.x} ${p.y})"><circle cx="${d/2}" cy="${d/2}" r="${d/2-1}" fill="${filled?'#34564d':'#102731'}" stroke="${filled?'#d7b774':next?'#82b8a9':'#53656b'}" stroke-width="${filled?2:1.5}"/>
      ${filled?`<defs><clipPath id="${id}-${i}"><circle cx="${d/2}" cy="${d/2}" r="${d/2-3}"/></clipPath></defs><g class="dock-portrait" clip-path="url(#${id}-${i})"><image href="${portraitUrl}" x="${-d*.15}" y="${d*.02}" width="${d*1.3}" height="${d*1.3}" preserveAspectRatio="xMidYMin slice"/></g>`:`<path d="M${d*.53} ${d*.25}v${d*.33}a${d*.15} ${d*.15} 0 1 1 ${-d*.30} 0l${d*.07} ${d*.04}" fill="none" stroke="${next?'#9ecbb9':'#71838a'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`}</g>`;}).join('')}
    <text x="${w/2}" y="${h-1}" font-size="${h>40?11:10.5}" text-anchor="middle" font-weight="600" fill="${state.holding?'#fff1bb':'#c1d6cb'}">${escape(reward)}</text></g>`;
}
