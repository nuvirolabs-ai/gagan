import { Children, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
  useWindowDimensions: () => ({ width: 320, height: 700, scale: 2, fontScale: 1.3 }),
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { MetricStrip } from "../companion";

function mergedStyle(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) return value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.assign({}, ...value.map(mergedStyle));
}

describe("MetricStrip on a narrow Android screen", () => {
  it("gives every wrapped KPI content width and exposes its value to accessibility", () => {
    const items = [
      { label: "Present today", value: "1 / 1" },
      { label: "Visits", value: "12" },
      { label: "Orders", value: "3" },
      { label: "Collections", value: "₹42,500" },
    ];
    const strip = MetricStrip({ items, bare: true });
    const cells = Children.toArray(strip.props.children) as ReactElement<any>[];

    expect(cells).toHaveLength(4);
    for (const [index, cell] of cells.entries()) {
      expect(mergedStyle(cell.props.style).flexBasis).toBe("50%");
      expect(cell.props.accessible).toBe(true);
      expect(cell.props.accessibilityLabel).toBe(`${items[index].label}: ${items[index].value}`);
      const text = Children.toArray(cell.props.children) as ReactElement<any>[];
      expect(text.map((node) => node.props.children)).toEqual([items[index].value, items[index].label]);
    }
  });
});
