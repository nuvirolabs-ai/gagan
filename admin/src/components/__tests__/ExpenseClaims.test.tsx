import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExpenseClaims from "../ExpenseClaims";

const { expenseHistory, expenseReceipt } = vi.hoisted(() => ({
  expenseHistory: vi.fn(),
  expenseReceipt: vi.fn(),
}));

vi.mock("../../api", () => ({ api: { expenseHistory, expenseReceipt } }));

const totals = {
  claimed: { count: 1, amount: "10.25" },
  submitted: { count: 1, amount: "10.25" },
  approved: { count: 0, amount: "0.00" },
  rejected: { count: 0, amount: "0.00" },
};
const claim = (id: string, description: string) => ({
  id, expenseDate: "2026-03-10T00:00:00.000Z", category: "fuel", amount: "10.25",
  description, status: "submitted", decisionNote: null, decidedAt: null,
  hasReceipt: true, receiptUrl: "https://signed.example/expired",
});
const history = (id: string, name: string, expenses: ReturnType<typeof claim>[], nextCursor: string | null = null) => ({
  salesperson: { id, name }, totals, expenses, nextCursor,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

beforeEach(() => {
  expenseHistory.mockReset();
  expenseReceipt.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("expense claim history", () => {
  it("ignores an older page from the previously selected person, including its receipt", async () => {
    const older = deferred<ReturnType<typeof history>>();
    expenseHistory.mockImplementation((id: string, cursor?: string) => {
      if (id === "person-a" && cursor) return older.promise;
      if (id === "person-a") return Promise.resolve(history(id, "Person A", [claim("a-1", "Current A")], "a-1"));
      return Promise.resolve(history(id, "Person B", [claim("b-1", "Current B")]));
    });
    const view = render(<ExpenseClaims salespersonId="person-a" />);
    fireEvent.click(await screen.findByRole("button", { name: "Load older claims" }));
    view.rerender(<ExpenseClaims salespersonId="person-b" />);
    expect(await screen.findByText("Current B")).toBeInTheDocument();
    await act(async () => {
      older.resolve(history("person-a", "Person A", [claim("a-older", "Private A receipt")]));
      await older.promise;
    });
    expect(screen.queryByText("Private A receipt")).toBeNull();
    expect(screen.getByText("Current B")).toBeInTheDocument();
    expect(screen.queryByText("Person A")).toBeNull();
  });

  it("requests a fresh scoped receipt URL on click, not the history's stale URL", async () => {
    expenseHistory.mockResolvedValue(history("person-a", "Person A", [claim("a-1", "Receipt claim")]));
    expenseReceipt.mockResolvedValue({ receiptUrl: "https://signed.example/fresh" });
    const opened = { location: { href: "about:blank" }, opener: null, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
    render(<ExpenseClaims salespersonId="person-a" />);
    fireEvent.click(await screen.findByRole("button", { name: "View receipt" }));
    await waitFor(() => expect(opened.location.href).toBe("https://signed.example/fresh"));
    expect(expenseReceipt).toHaveBeenCalledWith("person-a", "a-1");
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
  });

  it("closes a pending receipt tab if the selected person changes", async () => {
    const receipt = deferred<{ receiptUrl: string }>();
    expenseHistory.mockImplementation((id: string) => Promise.resolve(
      history(id, id === "person-a" ? "Person A" : "Person B", [claim(`${id}-1`, `Claim ${id}`)])
    ));
    expenseReceipt.mockReturnValue(receipt.promise);
    const opened = { location: { href: "about:blank" }, opener: null, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
    const view = render(<ExpenseClaims salespersonId="person-a" />);
    fireEvent.click(await screen.findByRole("button", { name: "View receipt" }));
    view.rerender(<ExpenseClaims salespersonId="person-b" />);
    expect(await screen.findByText("Claim person-b")).toBeInTheDocument();
    await act(async () => {
      receipt.resolve({ receiptUrl: "https://signed.example/person-a-private" });
      await receipt.promise;
    });
    expect(opened.close).toHaveBeenCalled();
    expect(opened.location.href).toBe("about:blank");
  });

  it("closes the tab and explains an unavailable receipt", async () => {
    expenseHistory.mockResolvedValue(history("person-a", "Person A", [claim("a-1", "Receipt claim")]));
    expenseReceipt.mockRejectedValue({ body: { error: "expense_receipt_not_found" } });
    const opened = { location: { href: "about:blank" }, opener: null, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(opened as unknown as Window);
    render(<ExpenseClaims salespersonId="person-a" />);
    fireEvent.click(await screen.findByRole("button", { name: "View receipt" }));
    expect(await screen.findByText("This claim's receipt is no longer available.")).toBeInTheDocument();
    expect(opened.close).toHaveBeenCalled();
  });
});
