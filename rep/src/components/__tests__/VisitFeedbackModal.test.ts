import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  Platform: { OS: "android" },
  StyleSheet: { create: (styles: unknown) => styles },
  Alert: { alert: vi.fn() },
  ActivityIndicator: "ActivityIndicator",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("../../api/repClient", () => ({ repApi: {} }));
vi.mock("../../location/deviceLocation", () => ({ captureForegroundLocation: vi.fn() }));
vi.mock("../../feedback/haptics", () => ({ haptic: vi.fn() }));
vi.mock("../../theme", () => ({ colors: {}, radius: {}, spacing: {} }));
vi.mock("../ui", () => ({
  Field: "Field",
  OptionGrid: "OptionGrid",
  PrimaryButton: "PrimaryButton",
  SecondaryButton: "SecondaryButton",
  inputStyle: {},
}));

import { NO_ORDER_REASONS } from "../VisitFeedbackModal";

describe("VisitFeedbackModal", () => {
  it("provides comprehensive reasons for not ordering", () => {
    const reasonValues = NO_ORDER_REASONS.map((r) => r.value);
    expect(reasonValues).toContain("already_has_stock");
    expect(reasonValues).toContain("price_issue");
    expect(reasonValues).toContain("not_interested");
    expect(reasonValues).toContain("outstanding_payment_issue");
    expect(reasonValues).toContain("owner_unavailable");
    expect(reasonValues).toContain("shop_closed");
    expect(reasonValues).toContain("product_unavailable");
    expect(reasonValues).toContain("other");
  });
});
