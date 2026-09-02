/**
 * Staging-only, read-only collateral until Gagan chooses a content/storage
 * owner. These records deliberately live behind the API so the mobile app does
 * not grow a second product catalogue or silently depend on local files.
 */
export const STAGING_SALES_KIT = [
  { id: "kit-catalogue", title: "Gagan product catalogue", type: "pdf", category: "Product catalogue", description: "Pack sizes and product story for retailer conversations.", url: "https://gagantoordal.com/", source: "demo" },
  { id: "kit-schemes", title: "Current scheme sheet", type: "link", category: "Schemes", description: "Use the scheme details already shown against the retailer and order.", url: "https://gagantoordal.com/", source: "demo" },
  { id: "kit-launch", title: "New launch: Gagan everyday staples", type: "image", category: "New launch", description: "A simple launch story for dal, rice, atta and sugar conversations.", url: "https://gagantoordal.com/", source: "demo" },
  { id: "kit-story", title: "The Gagan quality story", type: "link", category: "Brand story", description: "Open the brand site while speaking with a store owner.", url: "https://gagantoordal.com/", source: "demo" },
] as const;
