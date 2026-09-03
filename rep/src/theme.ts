export const colors = {
  bg: "#F3F6FA",
  surface: "#FFFFFF",
  surfaceAlt: "#E8F1F8",

  ink: "#0B1220",
  inkMuted: "#6B7C90",
  inkFaint: "#9AABBD",
  onDark: "#FFFFFF",
  onDarkMuted: "#8AA0B8",

  navy: "#0B1220",
  sky: "#5B9FD4",
  skySoft: "#D7E8F5",
  skyMid: "#8BB8DE",

  green: "#0B1220",
  greenDeep: "#0B1220",
  greenMid: "#5B9FD4",
  greenSoft: "#E4F0F9",

  gold: "#5B9FD4",
  goldSoft: "#E4F0F9",
  cream: "#EAF1F8",

  danger: "#C4462F",
  dangerSoft: "#F6E2DD",

  border: "#D7E2EE",
  track: "#D5E0EC",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
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
    shadowColor: "#0B1220",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};

/**
 * Vertical space the bottom tab bar occupies. Screens inside the tab
 * navigator must reserve this at the bottom or content hides behind it.
 */
export const TAB_BAR_SPACE = 88;

/** 68000 -> "₹68,000" using the Indian digit grouping the design uses. */
export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** Compact field figures: 48750 -> "₹48.8k", 221000 -> "₹2.21L". */
export function inrCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100000) {
    const lakh = value / 100000;
    const digits = Math.abs(lakh) >= 10 ? 0 : 2;
    return `₹${lakh.toFixed(digits).replace(/\.00$/, "")}L`;
  }
  if (abs >= 1000) {
    return `₹${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return inr(value);
}
