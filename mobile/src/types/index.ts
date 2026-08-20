export interface Variant {
  id: string;
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  price: string | null;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  variants: Variant[];
}

export interface CartLine {
  variantId: string;
  productName: string;
  /** Display-only label for the case, e.g. "1 kg × 30". */
  packSize: string;
  unitPrice: number;
  qty: number;
}

export interface OrderItem {
  id: string;
  variantId: string;
  qtyOrdered: number;
  unitPrice: string;
  qtyDelivered: number | null;
  weightDelivered: string | null;
  variant?: { unitSize: string; unit: string; unitsPerCase: number; product: { name: string } };
}

export interface Order {
  id: string;
  orderNo: number;
  status: "placed" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "rejected";
  orderTotal: string;
  createdAt: string;
  items: OrderItem[];
}

export interface LedgerEntry {
  id: string;
  type: "invoice" | "payment";
  amount: string;
  balanceAfter: string;
  createdAt: string;
}
