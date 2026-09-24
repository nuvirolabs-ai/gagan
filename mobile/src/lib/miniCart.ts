import type { CartLine } from "../types";

export interface MiniCartModel {
  visible: boolean;
  itemCount: number;
  subtotal: number;
  amountLabel: string;
}

/**
 * Presentation-only summary for the persistent cart affordance.
 *
 * The total is deliberately the existing local catalogue subtotal. It is not
 * presented as the final payable amount because the authoritative commercial
 * quote (freight, GST and any other server-approved values) is created later
 * in the existing Cart screen.
 */
export function getMiniCartModel(lines: readonly CartLine[], total: number): MiniCartModel {
  const itemCount = lines.reduce((count, line) => count + Math.max(0, line.qty), 0);
  return {
    visible: itemCount > 0,
    itemCount,
    subtotal: total,
    amountLabel: "Catalogue subtotal",
  };
}
