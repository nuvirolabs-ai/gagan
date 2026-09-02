export type ColorSchemeName = "light" | "dark";

const light = {
  canvas: "#F5F4F1",
  grouped: "#EBEAE6",
  surface: "#FFFFFF",
  label: "#1C1C1E",
  secondary: "#6E6E73",
  tertiary: "#8E8E93",
  separator: "#C6C6C8",
  fill: "#E8E8E4",
  positive: "#248A3D",
  negative: "#D70015",
  warning: "#C93400",
  info: "#007AFF",
  tabInactive: "#8E8E93",
};

const dark = {
  canvas: "#000000",
  grouped: "#1C1C1E",
  surface: "#1C1C1E",
  label: "#F5F5F7",
  secondary: "#98989D",
  tertiary: "#636366",
  separator: "#38383A",
  fill: "#2C2C2E",
  positive: "#30D158",
  negative: "#FF453A",
  warning: "#FF9F0A",
  info: "#0A84FF",
  tabInactive: "#8E8E93",
};

export type Tokens = typeof light;

export function tokensFor(scheme: string | null | undefined): Tokens {
  return scheme === "dark" ? dark : light;
}

export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const rgb = [n >> 16, (n >> 8) & 255, n & 255].map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const [lighter, darker] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, title: 34 };
