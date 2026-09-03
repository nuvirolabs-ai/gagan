export type ColorSchemeName = "light" | "dark";

/** Quiet Instrument DARK — chairman lock for Founders Today + Series. */
const quietInstrument = {
  canvas: "#0C0E12",
  grouped: "#14171C",
  surface: "#14171C",
  surfaceAlt: "#1A1E25",
  label: "#F2F4F7",
  secondary: "#8B93A7",
  tertiary: "#8B93A7",
  separator: "#2A303A",
  fill: "#1A1E25",
  positive: "#3DDC97",
  negative: "#FF6B6B",
  warning: "#F5C542",
  info: "#7AA2FF",
  tabInactive: "#8B93A7",
  accent: "#7AA2FF",
};

const light = quietInstrument;
const dark = quietInstrument;

export type Tokens = typeof quietInstrument;

export function tokensFor(_scheme: string | null | undefined): Tokens {
  return quietInstrument;
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

export { light, dark };
