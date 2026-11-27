export const RETAILER_GRADES = ["A", "B", "C", "D"] as const;

export const BUYER_CATEGORIES = [
  "Kirana / General Store",
  "Wholesaler",
  "Supermarket / Mart",
  "HoReCa (Hotel / Restaurant / Catering)",
  "Semi-Wholesaler",
  "Distributor",
  "Institution / Bulk Buyer",
] as const;

export const BUYER_SUB_CATEGORIES = [
  "Retail Kirana",
  "Wholesale Kirana",
  "Modern Trade / Mart",
  "Caterer / Mithai",
  "Hotel / Restaurant",
  "Grain Merchant",
  "Institutional",
  "Other",
] as const;

export const PAYMENT_TERMS_OPTIONS = [
  "Advance",
  "Cash on Delivery",
  "7 days",
  "15 days",
  "21 days",
  "30 days",
  "45 days",
] as const;

export type RetailerReferenceInput = {
  existingRetailerId?: string | null;
  retailerName: string;
  ownerName?: string | null;
  phone?: string | null;
  shopAddress?: string | null;
  city: string;
  isExistingCustomer?: boolean;
  notes?: string | null;
};
