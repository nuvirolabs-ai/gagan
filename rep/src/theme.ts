export const colors = {
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F3F6",

  ink: "#0E1729",
  inkMuted: "#697386",
  inkFaint: "#9AA4B2",
  onDark: "#FFFFFF",
  onDarkMuted: "#C9D2DF",

  navy: "#0B1324",
  blue: "#2D7FF9",
  blueSoft: "#E8F1FF",
  blueMid: "#5EA0FF",
  blueInk: "#1769D2",

  /* Achievement only. Lime is intentionally not a general brand colour. */
  lime: "#C7F42B",
  limeSoft: "#F0FFC2",

  green: "#1F5132",
  greenDeep: "#123122",
  greenMid: "#2E6B47",
  greenSoft: "#E7F0E9",

  gold: "#C9992B",
  goldSoft: "#F5E7C9",
  cream: "#F4E6CE",

  danger: "#C4462F",
  dangerSoft: "#F6E2DD",

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

  border: "#E2E6EC",
  track: "#DDE3EB",

  /* Semantic aliases used by the companion system. Same values, clearer names. */
  canvas: "#F4F6F9",
  surfaceSecondary: "#F1F3F6",
  textPrimary: "#0E1729",
  textSecondary: "#697386",
  textTertiary: "#9AA4B2",
  separator: "#E2E6EC",
  primaryDeep: "#123122",
  primary: "#2D7FF9",
  primarySoft: "#E8F1FF",
  goldStrong: "#8A6A12",
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  focus: 26,
  hero: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  section: 24,
  block: 32,
  hero: 40,
};

export const type = {
  display: { fontSize: 30, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.7, fontVariant: ["tabular-nums"] as const },
  screenTitle: { fontSize: 26, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.6 },
  sectionTitle: { fontSize: 13, fontWeight: "600" as const, color: colors.ink, letterSpacing: 0.4 },
  cardTitle: { fontSize: 17, fontWeight: "600" as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.ink, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, color: colors.ink },
  metricXL: { fontSize: 36, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.9, fontVariant: ["tabular-nums"] as const },
  metricLarge: { fontSize: 22, fontWeight: "600" as const, color: colors.ink, letterSpacing: -0.3 },
  metricMedium: { fontSize: 17, fontWeight: "600" as const, color: colors.ink },
  caption: { fontSize: 13, fontWeight: "400" as const, color: colors.inkMuted, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "500" as const, color: colors.inkMuted, letterSpacing: 0.2 },
  micro: { fontSize: 11, fontWeight: "500" as const, color: colors.inkMuted },
  /* Backward-compatible aliases used by older screens. */
  title: { fontSize: 22, fontWeight: "600" as const, color: colors.ink },
  section: { fontSize: 13, fontWeight: "600" as const, color: colors.ink },
};

export const elevation = {
  none: {},
  card: {},
  floating: {
    shadowColor: "#2A2013",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

/** Kept for existing imports. Most cards no longer use a drop shadow. */
export const shadow = {
  card: elevation.card,
  floating: elevation.floating,
};

export const motion = {
  fast: 160,
  base: 220,
  slow: 320,
};

export const control = {
  minTap: 44,
  buttonHeight: 48,
  chipHeight: 36,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
};

/**
 * Vertical space the tab bar occupies. Screens inside the tab navigator must
 * reserve this at the bottom or content hides behind it.
 */
export const TAB_BAR_SPACE = 88;

/** Chip row must never inherit leftover column height while lists load. */
export const FILTER_CHIP_HEIGHT = 40;
export const FILTER_ROW_HEIGHT = 44;

export function headerInsetTop(safeTop: number, androidStatusBar = 0): number {
  return Math.max(safeTop, androidStatusBar) + spacing.md;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function composeGreeting(salutation: string, fullName: string): string {
  const first = fullName.trim().split(/\s+/).filter(Boolean)[0] ?? "";
  const phrase = salutation.trim();
  if (!first) return phrase.replace(/[.,]+$/, "");
  const cleaned = phrase
    .replace(new RegExp(`[,.\\s]*${escapeRegExp(first)}`, "gi"), " ")
    .replace(/[.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? `${cleaned}, ${first}` : first;
}

/** Narrow phones wrap KPI grids instead of squeezing three truncated labels. */
export function metricColumnCount(width: number, itemCount: number, longestLabelLength = 0): number {
  if (itemCount <= 1) return 1;
  if (itemCount === 2) return 2;
  if (itemCount >= 4) return 2;
  if (width < 390 || longestLabelLength > 12) return 2;
  return 3;
}

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

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function greetingForHour(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
