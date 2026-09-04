export const colors = {
  // V2.1 field system: a quiet neutral canvas, one dark structural colour,
  // and one reserved alert colour. Keep aliases below so older screens inherit
  // the same system without page-by-page palette drift.
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F5",

  ink: "#0B1220",
  inkMuted: "#667085",
  inkFaint: "#98A2B3",
  onDark: "#FFFFFF",
  onDarkMuted: "#D0D5DD",

  navy: "#0B1220",
  blue: "#0B1220",
  blueSoft: "#F0F2F5",
  blueMid: "#667085",
  blueInk: "#0B1220",

  // Kept as compatibility names. The new field UI intentionally has no neon
  // achievement colour; milestones use the same dark instrument colour.
  lime: "#0B1220",
  limeSoft: "#F0F2F5",

  green: "#0B1220",
  greenDeep: "#0B1220",
  greenMid: "#667085",
  greenSoft: "#F0F2F5",

  gold: "#0B1220",
  goldSoft: "#F0F2F5",
  cream: "#F5F6F8",

  danger: "#B9382E",
  dangerSoft: "#FBE9E7",

  /**
   * Compatibility aliases for older feature surfaces. V2.1 uses the dark
   * structural colour for actions and achievement emphasis; the only separate
   * chromatic family reserved for UI state is the muted alert red.
   */
  accentPrimary: "#0B1220",
  accentStrong: "#0B1220",
  accentSoft: "#F0F2F5",
  onAccent: "#FFFFFF",

  /**
   * Status stays status. These never borrow the accent, so "warning" cannot be
   * confused with "you are doing well".
   */
  success: "#344054",
  successSoft: "#F0F2F5",
  warning: "#B9382E",
  warningSoft: "#FBE9E7",
  error: "#B9382E",
  errorSoft: "#FBE9E7",
  info: "#667085",
  infoSoft: "#F0F2F5",

  border: "#E4E7EC",
  track: "#E4E7EC",

  /* Semantic aliases used by the companion system. Same values, clearer names. */
  canvas: "#F5F6F8",
  surfaceSecondary: "#F0F2F5",
  textPrimary: "#0B1220",
  textSecondary: "#667085",
  textTertiary: "#98A2B3",
  separator: "#E4E7EC",
  primaryDeep: "#0B1220",
  primary: "#0B1220",
  primarySoft: "#F0F2F5",
  goldStrong: "#0B1220",
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
    shadowColor: colors.navy,
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
