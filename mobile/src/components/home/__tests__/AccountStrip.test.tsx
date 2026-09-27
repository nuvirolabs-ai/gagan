import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View",
  useWindowDimensions: () => ({ width: 360 }),
}));
vi.mock("../../finance/EntityAttribution", () => ({ default: "EntityAttribution" }));
vi.mock("../../../theme", () => ({
  colors: {}, radius: {}, spacing: { sm: 8, md: 12, lg: 16 },
  inr: (amount: number) => `₹${amount.toLocaleString("en-IN")}`,
}));
vi.mock("../../../i18n/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => ({
    "home.dues": "Dues",
    "home.ledger": "Ledger",
    "home.pay": "Pay",
    "finance.underReview": "Under review",
    "finance.balanceUnderReview": "Account balance under review",
  })[key] ?? key }),
}));

import AccountStrip from "../AccountStrip";

function visibleText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(visibleText).join(" ");
  if (!isValidElement(node)) return "";
  return visibleText((node.props as { children?: ReactNode }).children);
}

describe("AccountStrip reconciliation state", () => {
  const account = {
    kind: "reconciliation" as const,
    outstanding: 62412,
    overdue: null,
    available: null,
    entityRows: [],
    entityAttributionStatus: "review_required" as const,
  };

  it("shows the reported amount as dues under review without a Pay action", () => {
    const tree = AccountStrip({ account, onPay: vi.fn(), onLedger: vi.fn() });
    const text = visibleText(tree);
    expect(text).toContain("Dues");
    expect(text).toContain("₹62,412");
    expect(text).toContain("Under review");
    expect(text).toContain("Ledger");
    expect(text).not.toContain("Pay");
  });

  it("does not turn an unavailable reported amount into zero dues", () => {
    const tree = AccountStrip({ account: { ...account, outstanding: null }, onPay: vi.fn(), onLedger: vi.fn() });
    expect(visibleText(tree)).not.toContain("₹0");
  });
});
