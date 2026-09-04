export const colors = {
  // V2.2 material system: cool neutral canvas, midnight/cobalt interaction
  // family, and a restrained coral alert family. Compatibility aliases below
  // intentionally resolve into this small palette so older screens do not
  // introduce a second visual language.
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF1F5",

  ink: "#081221",
  inkMuted: "#667085",
  inkFaint: "#98A2B3",
  onDark: "#FFFFFF",
  onDarkMuted: "#D7DEE9",

  navy: "#071426",
  blue: "#2F69F5",
  blueSoft: "#EAF1FF",
  blueMid: "#5C86E8",
  blueInk: "#2F69F5",

  // Legacy milestone aliases are now quiet members of the primary family;
  // V2.2 does not use neon/lime as a general-purpose UI colour.
  lime: "#2F69F5",
  limeSoft: "#EAF1FF",

  // Green is reserved for small, truthful success indicators.
  green: "#17815A",
  greenDeep: "#071426",
  greenMid: "#4D9B7C",
  greenSoft: "#E9F6EF",

  // Compatibility names map to the interaction family rather than creating a
  // gold/orange visual family in the field-sales UI.
  gold: "#2F69F5",
  goldSoft: "#EAF1FF",
  cream: "#F4F6F9",

  danger: "#CF4038",
  dangerSoft: "#FCEDEA",

  accentPrimary: "#2F69F5",
  accentStrong: "#071426",
  accentSoft: "#EAF1FF",
  onAccent: "#FFFFFF",

  success: "#17815A",
  successSoft: "#E9F6EF",
  warning: "#CF4038",
  warningSoft: "#FCEDEA",
  error: "#CF4038",
  errorSoft: "#FCEDEA",
  info: "#2F69F5",
  infoSoft: "#EAF1FF",

  border: "#DDE3EB",
  track: "#DDE3EB",

  /* Semantic aliases used by the companion system. */
  canvas: "#F4F6F9",
  surfaceSecondary: "#EEF1F5",
  textPrimary: "#081221",
  textSecondary: "#667085",
  textTertiary: "#98A2B3",
  separator: "#DDE3EB",
  primaryDeep: "#071426",
  primary: "#2F69F5",
  primarySoft: "#EAF1FF",
  goldStrong: "#071426",
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
  display: { fontSize: 32, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.8, fontVariant: ["tabular-nums"] as const },
  screenTitle: { fontSize: 28, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.7 },
  sectionTitle: { fontSize: 13, fontWeight: "600" as const, color: colors.ink, letterSpacing: 0.4 },
  cardTitle: { fontSize: 17, fontWeight: "600" as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.ink, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, color: colors.ink },
  metricXL: { fontSize: 38, fontWeight: "700" as const, color: colors.ink, letterSpacing: -1, fontVariant: ["tabular-nums"] as const },
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
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.075,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  floating: {
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  bar: {
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 3,
  },
};

/** Kept for existing imports. Most cards no longer use a drop shadow. */
export const shadow = {
  card: elevation.card,
  floating: elevation.floating,
};

export const motion = {
  fast: 110,
  base: 200,
  slow: 320,
  progress: 520,
  chart: 260,
  list: 200,
  sheet: 280,
};

export const control = {
  minTap: 44,
  buttonHeight: 54,
  chipHeight: 40,
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
