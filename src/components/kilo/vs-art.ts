export const VS_PORTRAITS = '/kilo-v81/vs/actions.webp';
export const VS_STRIPS = '/kilo-v79/vs/winner-reels.webp';
export const VS_ART_URLS = [VS_PORTRAITS, VS_STRIPS] as const;
export const vsActionIndex = (duelist:'king'|'vice',phase:0|1|2|3) => (duelist==='king'?0:4)+phase;
export const vsWinnerIndex = (duelist:'king'|'vice') => duelist==='king'?0:1;
