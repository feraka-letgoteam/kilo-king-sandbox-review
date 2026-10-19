/** Shared control geometry. CSS pixels, never a scale factor for the game. */
export const CONTROL_TOKENS = {
  target: 44,
  gap: 8,
  moduleGap: 12,
  desktopSpin: 100,
  desktopGroup: 888,
  desktopWideGroup: 1424,
  desktopWideThreshold: 1100,
  desktopWideCoverage: 0.78,
  desktopWideSpin: 128,
  desktopWideSecondary: 64,
  desktopWideWell: 88,
  desktopWideBet: 196,
  desktopWideGap: 16,
  desktopWideSpinGap: 8,
  desktopModuleGap: 8,
  desktopSpinGap: 6,
  mobileSpin: 96,
  narrowSpin: 80,
  portraitGroup: 336,
  portraitReadout: 44,
  portraitBet: 112,
  betPlateHeight: 64,
  portraitModuleGap: 16,
  portraitBadgeInset: 4,
  compactSpin: 64,
  secondaryRim: 2,
  wellRim: 3,
  spinRim: 3,
  wellRadius: 7,
  numericInset: 10,
  labelSize: 14,
  amountSize: 28,
  reasonWidth: 176,
} as const;

export type ControlJurisdiction = {
  disabledTurbo?: boolean;
  disabledAutoplay?: boolean;
  disabledBuyFeature?: boolean;
  disabledAnte?: boolean;
  /** Hide restricted actions by default. Disable keeps the rim and a reason. */
  restrictedPresentation?: "hide" | "disable";
};
export type RestrictedControl = "turbo" | "auto" | "buy" | "ante";
export function controlAvailability(
  control: RestrictedControl,
  flags: ControlJurisdiction = {},
) {
  const disabled =
    !!flags[
      {
        turbo: "disabledTurbo",
        auto: "disabledAutoplay",
        buy: "disabledBuyFeature",
        ante: "disabledAnte",
      }[control] as keyof ControlJurisdiction
    ];
  return {
    disabled,
    hidden: disabled && flags.restrictedPresentation !== "disable",
    reason: disabled ? "Unavailable in this jurisdiction" : undefined,
  };
}

export type ControlTheme = {
  edgeLight: string;
  edge: string;
  edgeShade: string;
  /** Optional return highlight and enamel midtone; do not affect geometry. */
  edgeReturn?: string;
  faceLight: string;
  faceMid?: string;
  face: string;
  well: string;
  wellLight: string;
  accent: string;
  selected: string;
  text: string;
  /** Optional brighter ink for figures and icons; falls back to text. */
  emphasis?: string;
  /** Icon ink is separate from the warmer numeric ink. */
  iconInk?: string;
  /** Optional clearcoat colors. Transparent values remove the glass finish. */
  glassHighlight?: string;
  glassEdge?: string;
  muted: string;
  numericFont: string;
  headingFont: string;
};
export const DEFAULT_CONTROL_THEME: ControlTheme = {
  edgeLight: "#eed39c",
  edge: "#b28c50",
  edgeShade: "#59412b",
  edgeReturn: "#d0ac6b",
  faceLight: "#203c40",
  faceMid: "#102a30",
  face: "#020c12",
  well: "#01070b",
  wellLight: "#0b2229",
  accent: "#79cbb0",
  selected: "#225b4b",
  text: "#f5ead4",
  emphasis: "#fff8e8",
  iconInk: "#ffffff",
  glassHighlight: "#ffffff12",
  glassEdge: "#ffffff26",
  muted: "#b6c6be",
  numericFont: '"Source Sans 3", sans-serif',
  headingFont: '"Barlow Condensed", sans-serif',
};
export function controlThemeStyle(theme: ControlTheme = DEFAULT_CONTROL_THEME) {
  return {
    ...Object.fromEntries(
      Object.entries(theme).map(([key, value]) => [`--sc-${key}`, value]),
    ),
    "--sc-secondary-rim": `${CONTROL_TOKENS.secondaryRim}px`,
    "--sc-well-rim": `${CONTROL_TOKENS.wellRim}px`,
    "--sc-spin-rim": `${CONTROL_TOKENS.spinRim}px`,
    "--sc-radius": `${CONTROL_TOKENS.wellRadius}px`,
    "--sc-label-size": `${CONTROL_TOKENS.labelSize}px`,
  };
}
