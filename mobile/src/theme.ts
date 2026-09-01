export const colors = {
  bg: "#F7F4EC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1EEE4",

  ink: "#16241B",
  inkMuted: "#7A8780",
  inkFaint: "#A8B2AB",
  onDark: "#FFFFFF",
  onDarkMuted: "#B9C9BE",

  green: "#1F5132",
  greenDeep: "#123122",
  greenMid: "#2E6B47",
  greenSoft: "#E7F0E9",

  gold: "#C9992B",
  goldSoft: "#F5E7C9",
  cream: "#F4E6CE",

  danger: "#C4462F",
  dangerSoft: "#F6E2DD",

  /* ---------------------------- semantic roles ---------------------------- */

  /**
   * The warm brand accent. It carries recognition and progress towards a goal —
   * achievements, target bars, the pack a shopper has chosen — which is what
   * keeps green for actions instead of colouring the whole product green.
   *
   * `accentPrimary` is a surface colour only: at 2.6:1 on white it is not a
   * legible text colour. Text on top of it uses `onAccent`; accent-coloured
   * text on a light background uses `accentStrong`.
   */
  accentPrimary: "#C9992B",
  accentStrong: "#8A6A12",
  accentSoft: "#F5E7C9",
  onAccent: "#16241B",

  /**
   * Status stays status. These never borrow the accent, so "warning" cannot be
   * confused with "you are doing well".
   */
  success: "#1F5132",
  successSoft: "#E7F0E9",
  warning: "#9A6510",
  warningSoft: "#FBEFD8",
  error: "#C4462F",
  errorSoft: "#F6E2DD",
  info: "#2F5B8F",
  infoSoft: "#DFEAF6",

  border: "#E7E1D4",
  track: "#DFDACD",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const type = {
  display: { fontSize: 26, fontWeight: "700" as const, color: colors.ink },
  title: { fontSize: 19, fontWeight: "700" as const, color: colors.ink },
  section: { fontSize: 17, fontWeight: "700" as const, color: colors.ink },
  body: { fontSize: 14, fontWeight: "500" as const, color: colors.ink },
  label: { fontSize: 12.5, fontWeight: "500" as const, color: colors.inkMuted },
  micro: { fontSize: 11, fontWeight: "600" as const, color: colors.inkMuted },
};

export const shadow = {
  card: {
    shadowColor: "#2A2013",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#2A2013",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};

/**
 * Vertical space the floating tab bar occupies. Screens inside the tab
 * navigator must reserve this at the bottom or content hides behind it.
 */
export const TAB_BAR_SPACE = 96;

/**
 * WCAG 2.1 relative luminance, used to keep the palette honest: a token pair
 * that fails contrast is a bug the tests catch rather than something a reader
 * has to squint at.
 */
function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Contrast ratio between two token colours, 1 (identical) to 21 (max). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 68000 -> "₹68,000" using the Indian digit grouping the design uses. */
export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
