import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: "View", Text: "Text", TouchableOpacity: "TouchableOpacity", FlatList: "FlatList",
  StyleSheet: { create: (styles: unknown) => styles }, RefreshControl: "RefreshControl",
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("../api/repClient", () => ({ repApi: {} }));
vi.mock("../../api/repClient", () => ({ repApi: {} }));
vi.mock("../../context/RepContext", () => ({ useRep: () => ({ staff: null }) }));
vi.mock("../../context/FieldContext", () => ({ useField: () => ({ today: null }) }));
vi.mock("../../theme", () => ({ colors: {}, radius: {}, spacing: {} }));
vi.mock("../../layout/viewportPolicy", () => ({ SCREEN_CONTENT_BOTTOM_GAP: 0 }));
vi.mock("../../components/ui", () => ({ StatusChip: "StatusChip" }));
vi.mock("../../auth/staffCapabilities", () => ({ staffCapabilities: () => ({}) }));
vi.mock("../../i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

import { OutletCard } from "../RepRetailersScreen";

function content(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(content).join(" ");
  if (!isValidElement(node)) return "";
  const props = node.props as { label?: string; children?: ReactNode };
  return [props.label, content(props.children)].filter(Boolean).join(" ");
}

describe("outlet card financial presentation", () => {
  it("shows one complete review warning without disputed amounts", () => {
    const rendered = content(OutletCard({
      item: { name: "Mahesh Store", shopAddress: "Pune" },
      reviewRequired: true,
      dueLabel: "Account balance under review",
      dueTone: "danger",
      creditLabel: "Credit under review",
      chip: { label: "Account balance under review", tone: "danger" },
      onPress: vi.fn(),
    }));
    expect(rendered.match(/Account balance under review/g)).toHaveLength(1);
    expect(rendered).not.toContain("Credit under review");
  });

  it("retains due and available credit for a normal account", () => {
    const rendered = content(OutletCard({
      item: { name: "Annapurna Foods", shopAddress: "Pune" },
      reviewRequired: false,
      dueLabel: "Rs 3,120 overdue",
      dueTone: "danger",
      creditLabel: "Rs 79,889 credit",
      chip: { label: "Overdue", tone: "danger" },
      onPress: vi.fn(),
    }));
    expect(rendered).toContain("Rs 3,120 overdue");
    expect(rendered).toContain("Rs 79,889 credit");
  });
});
