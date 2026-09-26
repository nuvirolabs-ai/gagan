import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useMemo: (compute: () => unknown) => compute(), useState: (initial: unknown) => [initial, vi.fn()] };
});
vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles }, Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("../ProductThumb", () => ({ default: "ProductThumb" }));
vi.mock("../ui", () => ({ QtyStepper: "QtyStepper" }));
vi.mock("../../theme", () => ({ colors: {}, radius: {}, spacing: {}, shadow: { card: {} } }));

import ProductGroupCard, { type Sku } from "../ProductGroupCard";

function content(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(content).join(" ");
  if (!isValidElement(node)) return "";
  return content((node.props as { children?: ReactNode }).children);
}

const skus: Sku[] = ["1 kg", "5 kg", "30 kg"].map((packLabel, index) => ({
  id: `sku-${index}`, productId: "product-1", packLabel, packDetail: packLabel,
  unitSize: String(index + 1), unitsPerCase: 1, price: null,
  orderable: false, orderingReason: "Ordering setup pending",
}));

describe("product group footer", () => {
  it("does not repeat a non-orderable reason or clip a redundant pack count", () => {
    const tree = ProductGroupCard({
      group: { id: "product-1", name: "Test Dal", category: "Daal", imageUrl: null, skus, hasMultiplePacks: true },
      qtyFor: () => 0, onChangeQty: vi.fn(), appearance: "row",
    });
    const rendered = content(tree);
    expect(rendered.match(/Ordering setup pending/g)).toHaveLength(1);
    expect(rendered).not.toContain("pack sizes");
  });
});
