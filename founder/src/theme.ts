/** Quiet Instrument DARK — chairman lock for Founders Today + Series. */
export const colors = {
  bg: "#0C0E12",
  panel: "#14171C",
  panelAlt: "#1A1E25",
  line: "#2A303A",
  ink: "#F2F4F7",
  muted: "#8B93A7",
  up: "#3DDC97",
  warn: "#F5C542",
  bad: "#FF6B6B",
  accent: "#7AA2FF",
  present: "#7AA2FF",
  pay: "#F5C542",
  stock: "#8B93A7",
  ghost: "#2A303A",
  chipOn: "rgba(61, 220, 151, 0.14)",
  chipOnBorder: "rgba(61, 220, 151, 0.55)",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 22,
};

export const type = {
  brand: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: colors.muted,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  display: { fontSize: 34, fontWeight: "800" as const, color: colors.ink, letterSpacing: -0.6 },
  kpi: { fontSize: 26, fontWeight: "800" as const, color: colors.ink, letterSpacing: -0.4 },
  kpiSm: { fontSize: 20, fontWeight: "800" as const, color: colors.ink, letterSpacing: -0.3 },
  title: { fontSize: 16, fontWeight: "700" as const, color: colors.ink },
  body: { fontSize: 13, fontWeight: "500" as const, color: colors.ink },
  meta: { fontSize: 11, fontWeight: "500" as const, color: colors.muted },
  caps: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
  micro: { fontSize: 10, fontWeight: "600" as const, color: colors.muted },
};

export const TAB_BAR_SPACE = 64;

export type Tone = "up" | "down" | "warn" | "muted" | "accent";

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "up":
      return colors.up;
    case "down":
      return colors.bad;
    case "warn":
      return colors.warn;
    case "accent":
      return colors.accent;
    default:
      return colors.muted;
  }
}
