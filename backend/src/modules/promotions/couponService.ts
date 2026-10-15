export interface CouponDefinition {
  code: string;
  type: "flat" | "percentage";
  value: number; // e.g. 500 for flat, 5 for 5%
  minOrderValue: number;
  maxDiscount?: number;
  description: string;
}

export const ACTIVE_COUPONS: Record<string, CouponDefinition> = {
  WELCOME500: {
    code: "WELCOME500",
    type: "flat",
    value: 500,
    minOrderValue: 3000,
    description: "₹500 flat discount on orders above ₹3,000",
  },
  DIWALI5: {
    code: "DIWALI5",
    type: "percentage",
    value: 5,
    minOrderValue: 5000,
    maxDiscount: 1000,
    description: "5% discount (up to ₹1,000) on orders above ₹5,000",
  },
  SAVE10: {
    code: "SAVE10",
    type: "percentage",
    value: 10,
    minOrderValue: 10000,
    maxDiscount: 2000,
    description: "10% discount (up to ₹2,000) on orders above ₹10,000",
  },
  SPECIAL100: {
    code: "SPECIAL100",
    type: "flat",
    value: 100,
    minOrderValue: 1000,
    description: "₹100 flat discount on orders above ₹1,000",
  },
};

export type CouponEvaluationResult =
  | {
      valid: true;
      coupon: CouponDefinition;
      discountAmount: number;
      finalTotal: number;
    }
  | {
      valid: false;
      error: "invalid_coupon" | "coupon_min_value_not_met";
      minOrderValue?: number;
      code: string;
    };

export function evaluateCoupon(
  rawCode: string | null | undefined,
  subtotal: number
): CouponEvaluationResult {
  if (!rawCode || typeof rawCode !== "string") {
    return { valid: false, error: "invalid_coupon", code: "" };
  }

  const code = rawCode.trim().toUpperCase();
  const coupon = ACTIVE_COUPONS[code];

  if (!coupon) {
    return { valid: false, error: "invalid_coupon", code };
  }

  if (subtotal < coupon.minOrderValue) {
    return {
      valid: false,
      error: "coupon_min_value_not_met",
      minOrderValue: coupon.minOrderValue,
      code,
    };
  }

  let discountAmount = 0;
  if (coupon.type === "flat") {
    discountAmount = Math.min(subtotal, coupon.value);
  } else if (coupon.type === "percentage") {
    const rawDiscount = Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
    discountAmount = coupon.maxDiscount ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount;
  }

  // Round to 2 decimal places
  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  return {
    valid: true,
    coupon,
    discountAmount,
    finalTotal,
  };
}

export function getAvailableCoupons(): CouponDefinition[] {
  return Object.values(ACTIVE_COUPONS);
}

