export interface HomeSalesRep {
  name: string;
  phone: string;
  photoUrl: string | null;
}

export interface HomeCredit {
  outstanding: number;
  overdue: number;
  creditLimit: number;
  used: number;
  available: number;
  utilisationPct: number;
}

export interface HomeScheme {
  name: string;
  headline: string;
  targetAmount: number;
  discountAmount: number;
  progress: number;
  remaining: number;
}

export interface QuickOrderItem {
  productId: string;
  variantId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  unitSize: string;
  unitsPerCase: number;
  casePrice: string | null;
}

export interface HomeActiveOrder {
  id: string;
  orderNo: number;
  status: "placed" | "confirmed" | "packed" | "out_for_delivery" | "delivered";
  orderTotal: number;
  itemCount: number;
  createdAt: string;
  expectedDeliveryAt: string | null;
}

export interface HomePayload {
  retailer: { id: string; name: string; phone: string; tier: string };
  salesRep: HomeSalesRep | null;
  credit: HomeCredit;
  scheme: HomeScheme | null;
  quickOrder: QuickOrderItem[];
  categories: string[];
  activeOrder: HomeActiveOrder | null;
  config: { freeDeliveryThreshold: number; minOrderValue: number; supportPhone: string | null };
  badges: { notifications: number; activeOffers: number };
}
