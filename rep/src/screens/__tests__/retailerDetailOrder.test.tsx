import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ index: 0, values: new Map<number, unknown>() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = state.index++;
      return [state.values.has(index) ? state.values.get(index) : initial, vi.fn()];
    },
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useCallback: (callback: unknown) => callback,
  };
});
vi.mock("react-native", () => ({
  Image: "Image", View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles }, Alert: { alert: vi.fn() }, Linking: { openURL: vi.fn() },
}));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "Icon" }));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("../../api/repClient", () => ({ repApi: {} }));
vi.mock("../../location/deviceLocation", () => ({ captureForegroundLocation: vi.fn() }));
vi.mock("../../context/RepContext", () => ({ useRep: () => ({ staff: { permissions: [] }, setActiveRetailer: vi.fn() }) }));
vi.mock("../../auth/staffCapabilities", () => ({ staffCapabilities: () => ({}) }));
vi.mock("../../theme", () => ({ colors: { primary: "#000", ink: "#000" }, spacing: { sm: 8, md: 12, lg: 16, xl: 20, section: 24 }, inr: (value: number) => `INR ${value}` }));
vi.mock("../../components/ui", () => Object.fromEntries([
  "AppScreen", "FocusCard", "InitialsBadge", "PrimaryButton", "SecondaryButton", "SectionHeader",
  "Skeleton", "StatusChip", "StatusPill", "Surface", "TextButton", "TimelineEvent", "KeyboardSafeScrollView",
].map((name) => [name, name])));
vi.mock("../../components/ActivityComposer", () => ({ default: "ActivityComposer", ACTIVITY_LABELS: {} }));
vi.mock("../../components/EntityAttribution", () => ({ default: "EntityAttribution" }));
vi.mock("../../feedback/haptics", () => ({ haptic: vi.fn() }));
vi.mock("../../i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../location/checkInErrors", () => ({ checkInErrorKey: () => "" }));
vi.mock("../activeRetailerVisit", () => ({ activeRetailerVisit: vi.fn() }));

import RepRetailerDetailScreen from "../RepRetailerDetailScreen";

function content(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return Array.isArray(node) ? node.map(content).join(" ") : "";
  const props = node.props as { title?: string; label?: string; children?: ReactNode };
  return [props.title, props.label, content(props.children)].filter(Boolean).join(" ");
}

describe("Salesperson retailer detail order", () => {
  beforeEach(() => {
    state.index = 0;
    state.values.clear();
  });

  it("renders name, check-in, intelligence, outstanding, then schemes before other content", () => {
    state.values.set(0, {
      retailer: { id: "store-1", name: "Test Store", shopAddress: "Main Road", lifecycle: "active" },
      credit: { outstanding: 120, overdue: 0, available: 500 },
      recentOrders: [], recentLedger: [], kyc: { status: "approved" }, financialSummary: {},
    });
    state.values.set(1, { status: "VERIFIED" });
    state.values.set(12, { trend: "unknown", regularCategories: [] });
    state.values.set(15, [{ id: "scheme-1", name: "Test Scheme", headline: "Offer", discountAmount: 10 }]);
    state.values.set(17, false);

    const screen = RepRetailerDetailScreen({ route: { params: { retailerId: "store-1" } }, navigation: {} });
    const scroll = Children.toArray(screen.props.children)[0] as React.ReactElement<{ children: ReactNode }>;
    const blocks = Children.toArray(scroll.props.children).map(content);
    const markers = ["Test Store", "retailer.checkIn", "Store intelligence", "profile.outstanding", "Schemes for this store"];

    expect(markers.map((marker) => blocks.findIndex((block) => block.includes(marker))))
      .toEqual([0, 1, 2, 3, 4]);
    for (const marker of markers) {
      expect(blocks.filter((block) => block.includes(marker))).toHaveLength(1);
    }
    expect(blocks.slice(5).join(" ")).toContain("retailer.recentOrders");
  });

  it("does not show a payable number for an account needing reconciliation", () => {
    state.values.set(0, {
      retailer: { id: "store-1", name: "Test Store", shopAddress: "Main Road", lifecycle: "active" },
      credit: { outstanding: 0, overdue: 0, available: 500 },
      recentOrders: [], recentLedger: [], kyc: { status: "approved" },
      financialSummary: { reconciliationRequired: true },
    });
    state.values.set(1, { status: "VERIFIED" });
    state.values.set(12, { trend: "unknown", regularCategories: [] });
    state.values.set(15, []);
    state.values.set(17, false);
    const screen = RepRetailerDetailScreen({ route: { params: { retailerId: "store-1" } }, navigation: {} });
    const scroll = Children.toArray(screen.props.children)[0] as React.ReactElement<{ children: ReactNode }>;
    const rendered = Children.toArray(scroll.props.children).map(content).join(" ");
    expect(rendered).toContain("finance.reviewTitle");
    expect(rendered).not.toContain("INR 0");
  });
});
