import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import FieldExpenses from "../FieldExpenses";
import { AuthContext } from "../../auth-context";

const { decideExpense, fieldExpenses } = vi.hoisted(() => ({
  decideExpense: vi.fn().mockResolvedValue({}),
  fieldExpenses: vi.fn(),
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
    decideExpense,
  },
}));

beforeEach(() => {
  fieldExpenses.mockResolvedValue({ expenses: [CLAIM] });
});

describe("Field expenses", () => {
  it("shows the claim with a signed receipt link rather than a storage key", async () => {
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("₹450")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "https://signed.example/receipt"
    );
  });

  it("records an approval decision", async () => {
    render(<FieldExpenses />, { wrapper: signedInAs("staff-deepak") });
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(decideExpense).toHaveBeenCalledWith("expense-1", "approved", undefined)
    );
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
