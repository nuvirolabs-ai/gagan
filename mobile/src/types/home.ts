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

/** One logical product with the packs it is sold in. The SKU stays the order unit. */
export interface HomeSku {
  id: string;
  productId: string;
  productName: string;
  packLabel: string;
  packDetail: string;
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  price: number | null;
  isOverride?: boolean;
  availability?: { status?: string; available?: number | null } | null;
}

export interface HomeProductGroup {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  description: string | null;
  productIds: string[];
  skus: HomeSku[];
  hasMultiplePacks: boolean;
}

export interface HomePayload {
  retailer: { id: string; name: string; phone: string; tier: string };
  salesRep: HomeSalesRep | null;
  credit: HomeCredit;
  scheme: HomeScheme | null;
  quickOrder: QuickOrderItem[];
  productGroups: HomeProductGroup[];
  categories: string[];
  activeOrder: HomeActiveOrder | null;
  config: { freeDeliveryThreshold: number; minOrderValue: number; supportPhone: string | null };
  badges: { notifications: number; activeOffers: number };
}
