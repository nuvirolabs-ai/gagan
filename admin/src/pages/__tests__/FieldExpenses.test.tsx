import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import FieldExpenses from "../FieldExpenses";
import { AuthContext } from "../../auth-context";

const { decideExpense, fieldExpenses, expenseHistory, expenseClaimants, expenseReceipt } = vi.hoisted(() => ({
  decideExpense: vi.fn().mockResolvedValue({}),
  fieldExpenses: vi.fn(),
  expenseHistory: vi.fn(),
  expenseClaimants: vi.fn(),
  expenseReceipt: vi.fn(),
}));

/** The signed-in reviewer. Rows belonging to them are treated differently. */
function signedInAs(staffId: string | null) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider
      value={{
        admin: { id: "a1", name: "Deepak Iyer", email: "deepak@gagan.test" },
        staffId,
        permissions: ["expense.review"],
        loading: false,
        login: async () => {},
        logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const CLAIM = {
  id: "expense-1",
  salespersonId: "staff-ravi",
  salesperson: { name: "Ravi Kumar" },
  expenseDate: "2026-03-10T00:00:00.000Z",
  category: "fuel",
  amount: 450,
  description: "Diesel, Kothrud beat",
  status: "submitted",
  hasReceipt: true,
  receiptUrl: "https://signed.example/receipt",
};

vi.mock("../../api", () => ({
  inr: (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`,
  api: {
    fieldExpenses,
    expenseHistory,
    expenseClaimants,
    expenseReceipt,
    decideExpense,
  },
}));

beforeEach(() => {
  fieldExpenses.mockResolvedValue({ expenses: [CLAIM] });
  expenseClaimants.mockResolvedValue({ claimants: [{ id: "staff-ravi", name: "Ravi Kumar" }] });
  expenseHistory.mockResolvedValue({
    salesperson: { id: "staff-ravi", name: "Ravi Kumar" },
    totals: {
      claimed: { count: 3, amount: "60.35" },
      submitted: { count: 1, amount: "10.25" },
      approved: { count: 1, amount: "40.00" },
      rejected: { count: 1, amount: "10.10" },
    },
    expenses: [{ ...CLAIM, amount: "10.25", decisionNote: null }],
    nextCursor: null,
  });
  expenseReceipt.mockResolvedValue({ receiptUrl: "https://signed.example/fresh" });
});

describe("Field expenses", () => {
  it("gets a fresh scope-checked receipt link on click in the review queue", async () => {
    const opened = { location: { href: "about:blank" }, opener: null, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    expect(await screen.findByRole("button", { name: "Ravi Kumar" })).toBeInTheDocument();
    expect(screen.getByText("₹450")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View receipt" }));
    await waitFor(() => expect(opened.location.href).toBe("https://signed.example/fresh"));
    expect(expenseReceipt).toHaveBeenCalledWith("staff-ravi", "expense-1");
  });

  it("records an approval decision", async () => {
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(decideExpense).toHaveBeenCalledWith("expense-1", "approved", undefined)
    );
  });

  it("opens a manager's read-only person history with explicitly labeled totals", async () => {
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.click(await screen.findByRole("button", { name: "Ravi Kumar" }));
    expect(await screen.findByText("Cumulative claimed")).toBeInTheDocument();
    expect(screen.getByText("Includes submitted, approved, and rejected claims.")).toBeInTheDocument();
    expect(screen.getByText("₹60.35")).toBeInTheDocument();
    expect(screen.getByText("Approved claims")).toBeInTheDocument();
    expect(screen.getByText("Rejected claims")).toBeInTheDocument();
    expect(screen.getByText("Diesel, Kothrud beat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("loads older claims without losing the cumulative total", async () => {
    expenseHistory.mockResolvedValueOnce({
      salesperson: { id: "staff-ravi", name: "Ravi Kumar" },
      totals: { claimed: { count: 2, amount: "20.25" }, submitted: { count: 2, amount: "20.25" }, approved: { count: 0, amount: "0.00" }, rejected: { count: 0, amount: "0.00" } },
      expenses: [{ ...CLAIM, amount: "10.25", receiptUrl: null }],
      nextCursor: "expense-1",
    }).mockResolvedValueOnce({
      salesperson: { id: "staff-ravi", name: "Ravi Kumar" },
      totals: { claimed: { count: 2, amount: "20.25" }, submitted: { count: 2, amount: "20.25" }, approved: { count: 0, amount: "0.00" }, rejected: { count: 0, amount: "0.00" } },
      expenses: [{ ...CLAIM, id: "expense-older", amount: "10.00", description: "Older fuel", receiptUrl: null }],
      nextCursor: null,
    });
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.click(await screen.findByRole("button", { name: "Ravi Kumar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Load older claims" }));
    expect(await screen.findByText("Older fuel")).toBeInTheDocument();
    expect(screen.getAllByText("₹20.25")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Load older claims" })).toBeNull();
  });

  it("can open a historical claimant who is absent from the capped review queue", async () => {
    fieldExpenses.mockResolvedValue({ expenses: [] });
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.change(await screen.findByLabelText("Person"), { target: { value: "staff-ravi" } });
    expect(await screen.findByText("Cumulative claimed")).toBeInTheDocument();
    expect(screen.getByText("₹60.35")).toBeInTheDocument();
  });
});

describe("a reviewer's own claim", () => {
  it("offers no decision the server would refuse", async () => {
    // A manager's own claim reaches their queue because they are inside their
    // own reporting scope. The server refuses the decision, so the buttons
    // would be a guaranteed failure.
    fieldExpenses.mockResolvedValue({
      expenses: [{ ...CLAIM, salespersonId: "staff-deepak", salesperson: { name: "Deepak Iyer" } }],
    });
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    expect(await screen.findByText(/Your own claim/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it("still offers decisions on everyone else's", async () => {
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
  });
});

describe("errors the API returns as codes", () => {
  it("explains a refused decision instead of printing the code", async () => {
    decideExpense.mockRejectedValueOnce({ body: { error: "expense_self_decision_forbidden" } });
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("You cannot decide your own expense claim.")).toBeInTheDocument();
    expect(screen.queryByText("expense_self_decision_forbidden")).toBeNull();
  });

  it("explains an out-of-scope refusal in words a manager can act on", async () => {
    decideExpense.mockRejectedValueOnce({ body: { error: "outside_reporting_scope" } });
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(
      await screen.findByText(/not in your team, so you cannot see or act on their work/)
    ).toBeInTheDocument();
  });
});
