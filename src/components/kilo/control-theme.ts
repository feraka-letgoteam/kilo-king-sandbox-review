import { MARINA } from "./material";
import type { ControlTheme } from "../slot-controls/tokens";
/** The only game-specific skin input. The system itself contains no Kilo assets. */
export const KILO_CONTROL_THEME: ControlTheme = {
  edgeLight: MARINA.brassLight,
  edge: MARINA.brass,
  edgeShade: MARINA.brassShade,
  edgeReturn: MARINA.brassReturn,
  faceLight: MARINA.enamelLight,
  faceMid: MARINA.enamel,
  face: "#020c12",
  well: "#01070b",
  wellLight: MARINA.wellBottom,
  accent: MARINA.teal,
  selected: MARINA.selectedTop,
  text: MARINA.text,
  emphasis: "#fff8e8",
  iconInk: "#ffffff",
  muted: MARINA.muted,
  numericFont: '"Source Sans 3", sans-serif',
  headingFont: '"Barlow Condensed", sans-serif',
};
