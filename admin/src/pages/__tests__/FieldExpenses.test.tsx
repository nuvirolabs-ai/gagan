import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FieldExpenses from "../FieldExpenses";

const { decideExpense } = vi.hoisted(() => ({ decideExpense: vi.fn().mockResolvedValue({}) }));

vi.mock("../../api", () => ({
  inr: (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`,
  api: {
    fieldExpenses: vi.fn().mockResolvedValue({
      expenses: [
        {
          id: "expense-1",
          salesperson: { name: "Ravi Kumar" },
          expenseDate: "2026-03-10T00:00:00.000Z",
          category: "fuel",
          amount: 450,
          description: "Diesel, Kothrud beat",
          status: "submitted",
          hasReceipt: true,
          receiptUrl: "https://signed.example/receipt",
        },
      ],
    }),
    decideExpense,
  },
}));

describe("Field expenses", () => {
  it("shows the claim with a signed receipt link rather than a storage key", async () => {
    render(<FieldExpenses />);
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("₹450")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "https://signed.example/receipt"
    );
  });

  it("records an approval decision", async () => {
    render(<FieldExpenses />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(decideExpense).toHaveBeenCalledWith("expense-1", "approved", undefined)
    );
  });
});
