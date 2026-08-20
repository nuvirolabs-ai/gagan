/** A line in the order a rep is building for a retailer. */
export interface CartLine {
  variantId: string;
  productName: string;
  /** Display-only label for the case, e.g. "1 kg × 30". */
  packSize: string;
  unitPrice: number;
  qty: number;
}
