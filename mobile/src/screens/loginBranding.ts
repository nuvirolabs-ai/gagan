/**
 * The supplied design is a tall editorial panel rather than a device-sized
 * screenshot. Keeping its native proportions prevents the photography and
 * packaging artwork from being stretched on smaller Android screens.
 */
export const RETAILER_LOGIN_ARTWORK = {
  source: "gagan-retailer-login.png",
  width: 472,
  height: 1024,
  bgYellow: "#FEDB4B",
  brandGreen: "#165A31",
  brandInk: "#0D3821",
  brandRed: "#E12026",
  cardTopPercent: "68%" as const,
  cardHeightPercent: "30%" as const,
  cardSidePercent: "5%" as const,
  brand: "GAGAN",
  title: "Welcome to GAGAN",
  subtitle: "Quality grains. Stronger communities.",
  support: "Contact your distributor",
} as const;

export const RETAILER_LOGIN_ARTWORK_LABEL = "GAGAN retailer login artwork";
