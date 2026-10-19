/** One palette and finish for the live HTML UI and the cabinet's vector plates. */
export const MARINA = {
  brassLight: "#f0d39a",
  brass: "#b28c50",
  brassShade: "#59412b",
  brassReturn: "#d0ac6b",
  enamelLight: "#203c40",
  enamel: "#102a30",
  enamelDeep: "#071820",
  wellTop: "#020c12",
  wellBottom: "#0b2229",
  selectedTop: "#286355",
  selectedBottom: "#174438",
  teal: "#79cbb0",
  text: "#f5ead4",
  muted: "#b6c6be",
} as const;
// Hand-authored surface grain: sparse horizontal abrasion, not extra ornament.
const brush = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><g fill="none" stroke="#b8c4a5" stroke-opacity=".07"><path d="M3 8h29m12 0h5m45 7h42M18 34h10m19 0h59M0 58h18m40 9h35m29-27h23M69 2h17M110 76h33"/></g><path d="M25 16h47m-58 4h7m21 31h77m-19-27h36" stroke="#020b10" stroke-opacity=".2"/></svg>`;
export const MATERIAL_STYLE = {
  "--kk-brass-light": MARINA.brassLight,
  "--kk-brass": MARINA.brass,
  "--kk-brass-shade": MARINA.brassShade,
  "--kk-enamel": MARINA.enamel,
  "--kk-deep": MARINA.enamelDeep,
  "--kk-teal": MARINA.teal,
  "--kk-text": MARINA.text,
  "--kk-muted": MARINA.muted,
  "--kk-grain": `url("data:image/svg+xml,${encodeURIComponent(brush)}")`,
  "--kk-metal": `linear-gradient(145deg,${MARINA.brassLight},${MARINA.brass} 26%,${MARINA.brassShade} 58%,${MARINA.brassReturn} 88%,${MARINA.brassShade})`,
  "--kk-face": `linear-gradient(155deg,${MARINA.enamelLight},${MARINA.enamel} 42%,${MARINA.enamelDeep})`,
  "--kk-well": `linear-gradient(${MARINA.wellTop},${MARINA.wellBottom})`,
  "--kk-selected": `linear-gradient(${MARINA.selectedTop},${MARINA.selectedBottom})`,
};
export function materialDefs(id: string) {
  return `<defs>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${MARINA.brassLight}"/><stop offset=".26" stop-color="${MARINA.brass}"/><stop offset=".58" stop-color="${MARINA.brassShade}"/><stop offset=".88" stop-color="${MARINA.brassReturn}"/><stop offset="1" stop-color="${MARINA.brassShade}"/></linearGradient>
    <linearGradient id="${id}-enamel" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="${MARINA.enamelLight}"/><stop offset=".42" stop-color="${MARINA.enamel}"/><stop offset="1" stop-color="${MARINA.enamelDeep}"/></linearGradient>
    <linearGradient id="${id}-well" x2="0" y2="1"><stop stop-color="${MARINA.wellTop}"/><stop offset="1" stop-color="${MARINA.wellBottom}"/></linearGradient>
    <linearGradient id="${id}-selected" x2="0" y2="1"><stop stop-color="${MARINA.selectedTop}"/><stop offset="1" stop-color="${MARINA.selectedBottom}"/></linearGradient>
    <pattern id="${id}-grain" width="160" height="80" patternUnits="userSpaceOnUse"><path d="M3 8h29m12 0h5m45 7h42M18 34h10m19 0h59M0 58h18m40 9h35m29-27h23M69 2h17M110 76h33" fill="none" stroke="#b8c4a5" stroke-opacity=".07"/></pattern>
  </defs>`;
}
