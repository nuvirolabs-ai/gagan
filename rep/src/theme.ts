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

/** 68000 -> "₹68,000" using the Indian digit grouping the design uses. */
export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
