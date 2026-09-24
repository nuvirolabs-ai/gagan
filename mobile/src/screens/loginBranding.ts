/**
 * The supplied design is a tall editorial panel rather than a device-sized
 * screenshot. Keeping its native proportions prevents the photography and
 * packaging artwork from being stretched on smaller Android screens.
 */
export const RETAILER_LOGIN_ARTWORK = {
  source: "gagan-retailer-login.png",
  width: 487,
  height: 1401,
  cardTopPercent: "44.5%" as const,
  cardHeightPercent: "43%" as const,
  cardSidePercent: "3%" as const,
  brand: "GAGAN",
  title: "Welcome to GAGAN",
  subtitle: "Quality grains. Stronger communities.",
  support: "Contact your distributor",
} as const;

export const RETAILER_LOGIN_ARTWORK_LABEL = "GAGAN retailer login artwork";
