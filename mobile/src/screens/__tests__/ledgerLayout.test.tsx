import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: 0 }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const useState = (initial: unknown) => {
    const values = [
      [{ id: "entry-1", type: "payment", amount: "9876543", balanceAfter: "12345678", createdAt: "2026-09-15T00:00:00.000Z", entityBreakdown: { jainTraders: 9876543, padamInternational: 0, unattributed: 0 } }],
      { balance: "0", limit: "0", overdue: "0", entityBalances: null },
      false,
      false,
      false,
    ];
    return [values[state.calls++] ?? initial, vi.fn()];
  };
  const useCallback = (fn: unknown) => fn;
  const useMemo = (fn: () => unknown) => fn();
  return {
    ...actual,
    default: { ...actual, useState, useCallback, useMemo },
    useState,
    useCallback,
    useMemo,
  };
});
vi.mock("react-native", () => ({
  View: "View", Text: "Text", SectionList: "SectionList", RefreshControl: "RefreshControl",
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => undefined }));
vi.mock("../../api/client", () => ({ api: { getLedger: vi.fn() } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ retailer: { id: "retailer-1" } }) }));
vi.mock("../../i18n/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string, vars?: { amount?: string }) => key === "ledger.balance" ? `Bal ${vars?.amount}` : key }) }));
vi.mock("../../components/ui", () => ({ EmptyState: "EmptyState", ScreenSkeleton: "ScreenSkeleton" }));

import LedgerScreen from "../LedgerScreen";
import EntityAttribution from "../../components/finance/EntityAttribution";

type TestElement = React.ReactElement<any>;

function childrenOf(node: TestElement): TestElement[] {
  return React.Children.toArray(node.props.children).filter(React.isValidElement);
}

function textOf(node: TestElement): string {
  return React.Children.toArray(node.props.children)
    .map((child) => typeof child === "string" ? child : typeof child === "number" ? String(child) : React.isValidElement(child) ? textOf(child) : "")
    .join("");
}

function descendants(node: TestElement): TestElement[] {
  if (typeof node.type === "function") {
    const component = node.type as (props: Record<string, unknown>) => TestElement;
    return [node, ...descendants(component(node.props))];
  }
  return [node, ...childrenOf(node).flatMap(descendants)];
}

describe("retailer ledger entry layout", () => {
  beforeEach(() => { state.calls = 0; });

  it("keeps large entry, running-balance, and entity amounts in wrapping full-width rows", () => {
    const screen = LedgerScreen() as TestElement;
    const list = childrenOf(screen).find((child) => child.type === "SectionList");
    expect(list).toBeDefined();
    const entry = list!.props.renderItem({ item: list!.props.sections[0].data[0] }) as TestElement;
    expect(entry.props.style.flexDirection).toBe("column");

    const texts = descendants(entry).filter((node) => node.type === "Text");
    for (const amount of ["₹98,76,543", "Bal ₹1,23,45,678"]) {
      const rendered = texts.find((node) => textOf(node).includes(amount));
      expect(rendered, amount).toBeDefined();
      expect(rendered!.props.numberOfLines).toBeUndefined();
    }
    expect(texts.filter((node) => textOf(node).includes("₹98,76,543"))).toHaveLength(2);
  });

  it("uses the shared full-width attribution while preserving Pay's compact inline variant", () => {
    const screen = LedgerScreen() as TestElement;
    const list = childrenOf(screen).find((child) => child.type === "SectionList")!;
    const entry = list.props.renderItem({ item: list.props.sections[0].data[0] }) as TestElement;
    const shared = descendants(entry).find((node) => node.type === EntityAttribution);
    expect(shared?.props.variant).toBe("stacked");

    const stacked = EntityAttribution({
      rows: [
        { key: "jainTraders", outstanding: 9876543, overdue: 0 },
        { key: "padamInternational", outstanding: 12345, overdue: 0 },
        { key: "unattributed", outstanding: 9, overdue: 0 },
      ],
      status: "review_required",
      variant: "stacked",
    }) as TestElement;
    expect(stacked.props.style.alignSelf).toBe("stretch");
    expect(childrenOf(stacked).map(textOf)).toEqual([
      "finance.jainTraders ₹98,76,543",
      "finance.padamInternational ₹12,345",
      "finance.unattributed ₹9",
      "finance.reviewRequired",
    ]);
    expect(childrenOf(stacked).every((node) => node.props.numberOfLines === undefined)).toBe(true);

    const inline = EntityAttribution({ rows: shared!.props.rows, status: null, variant: "inline" }) as TestElement;
    expect(inline.props.style.flexDirection).toBe("row");
    expect(childrenOf(inline)[0].props.numberOfLines).toBe(1);
  });
});
