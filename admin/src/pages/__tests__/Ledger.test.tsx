import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Ledger from "../Ledger";

const mocks = vi.hoisted(() => ({ retailers: vi.fn(), ledger: vi.fn(), recordPayment: vi.fn() }));
vi.mock("../../api", () => ({
  api: mocks,
  inr: (value: number | string) => `₹${Number(value).toFixed(2)}`,
}));

const showLedger = () =>
  render(
    <MemoryRouter initialEntries={["/ledger/retailer-1"]}>
      <Routes>
        <Route path="/ledger/:retailerId" element={<Ledger />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retailers.mockResolvedValue({ retailers: [{ id: "retailer-1", name: "Test Store" }] });
  mocks.ledger.mockResolvedValue({
    currentBalance: 95,
    creditLimit: 1000,
    overdueAmount: 70,
    financialSummary: {
      entityBalances: {
        outstanding: { jainTraders: 40, padamInternational: 30, unattributed: 25 },
        overdue: { jainTraders: 40, padamInternational: 30, unattributed: 0 },
        attributionStatus: "contains_unattributed",
      },
    },
    entries: [
      {
        id: "invoice-1",
        kind: "invoice",
        direction: "debit",
        amount: "100.00",
        balanceAfter: "100.00",
        createdAt: "2026-08-01T00:00:00.000Z",
        invoice: { invoiceNumber: 1 },
        entityBreakdown: {
          jainTraders: 60,
          padamInternational: 40,
          unattributed: 0,
          attributionStatus: "complete",
        },
      },
    ],
  });
});

describe("Admin financial entity attribution", () => {
  it("shows company balances and each ledger entry split without hiding the consolidated total", async () => {
    showLedger();

    expect(await screen.findByText("Company-wise balance")).toBeTruthy();
    expect(screen.getAllByText("Jain Traders")).toHaveLength(2);
    expect(screen.getAllByText("Padam International")).toHaveLength(2);
    expect(screen.getByText("Unattributed / legacy")).toBeTruthy();
    expect(screen.getByText("₹95.00")).toBeTruthy();
    expect(screen.getByText("₹40.00 overdue")).toBeTruthy();
    const invoiceCell = screen.getByText("Invoice #1").closest("td");
    expect(invoiceCell).toBeTruthy();
    expect(within(invoiceCell!).getByText("Jain Traders")).toBeTruthy();
    expect(within(invoiceCell!).getByText("₹60.00")).toBeTruthy();
    expect(within(invoiceCell!).getByText("Padam International")).toBeTruthy();
    expect(within(invoiceCell!).getByText("₹40.00")).toBeTruthy();
    expect(screen.getByText("Some historical or unallocated amounts are shown separately.")).toBeTruthy();
  });

  it("keeps review-required balances unattributed instead of assigning them to a company", async () => {
    mocks.ledger.mockResolvedValueOnce({
      currentBalance: 55,
      creditLimit: 1000,
      overdueAmount: 20,
      financialSummary: {
        entityBalances: {
          outstanding: { jainTraders: 0, padamInternational: 0, unattributed: 55 },
          overdue: { jainTraders: 0, padamInternational: 0, unattributed: 20 },
          attributionStatus: "review_required",
        },
      },
      entries: [],
    });
    showLedger();

    expect(await screen.findByText(/Review required/)).toBeTruthy();
    expect(screen.getAllByText("₹55.00")).toHaveLength(2);
    expect(screen.queryByText("Jain Traders")).toBeNull();
    expect(screen.queryByText("Padam International")).toBeNull();
  });

  it("does not display company attribution if its status requires review", async () => {
    mocks.ledger.mockResolvedValueOnce({
      currentBalance: 55,
      creditLimit: 1000,
      overdueAmount: 20,
      financialSummary: {
        entityBalances: {
          outstanding: { jainTraders: 55, padamInternational: 0, unattributed: 0 },
          overdue: { jainTraders: 20, padamInternational: 0, unattributed: 0 },
          attributionStatus: "review_required",
        },
      },
      entries: [],
    });
    showLedger();

    expect(await screen.findByText(/Review required/)).toBeTruthy();
    expect(screen.queryByText("Jain Traders")).toBeNull();
    expect(screen.getByText("Unattributed / legacy")).toBeTruthy();
  });

  it("hides company overdue details when they do not match consolidated overdue", async () => {
    mocks.ledger.mockResolvedValueOnce({
      currentBalance: 95,
      creditLimit: 1000,
      overdueAmount: 70,
      financialSummary: {
        entityBalances: {
          outstanding: { jainTraders: 40, padamInternational: 30, unattributed: 25 },
          overdue: { jainTraders: 40, padamInternational: 20, unattributed: 0 },
          attributionStatus: "contains_unattributed",
        },
      },
      entries: [],
    });
    showLedger();

    expect(await screen.findByText("Company-wise balance")).toBeTruthy();
    expect(screen.queryByText(/overdue$/)).toBeNull();
  });
});
