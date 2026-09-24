/**
 * The supplied design is a tall editorial panel rather than a device-sized
 * screenshot. Keeping its native proportions prevents the field-sales hero
 * from being stretched on smaller Android screens.
 */
export const SALESPERSON_LOGIN_ARTWORK = {
  source: "gagan-sales-login.png",
  width: 487,
  height: 1401,
  cardTopPercent: "44.5%" as const,
  cardHeightPercent: "43%" as const,
  cardSidePercent: "3%" as const,
  brand: "GAGAN SALES",
  title: "Welcome to GAGAN SALES",
  subtitle: "Serve better. Grow together.",
  support: "Contact your manager",
} as const;

export const SALESPERSON_LOGIN_ARTWORK_LABEL = "GAGAN Sales login artwork";
