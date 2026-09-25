import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Recovery from "../Recovery";

vi.mock("../../api", () => ({
  api: {
    recoveryCases: vi.fn(),
    recoveryTimeline: vi.fn(),
    logRecoveryCall: vi.fn(),
    createRecoveryPromise: vi.fn(),
    setRecoveryPromiseStatus: vi.fn(),
  },
  inr: (amount: number) => `₹${amount}`,
}));

const recoveryCase = {
  id: "case-1",
  retailer: { name: "Mahesh Store" },
  invoice: { invoiceNumber: "INV-100", outstandingAmount: 12_500 },
  actions: [{ type: "sales_call", status: "pending" }],
};

describe("recovery commitments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.recoveryCases).mockResolvedValue({ cases: [recoveryCase] });
    vi.mocked(api.recoveryTimeline).mockResolvedValue({ events: [] });
    vi.mocked(api.logRecoveryCall).mockResolvedValue({ call: { id: "call-1" } });
    vi.mocked(api.createRecoveryPromise).mockResolvedValue({ promise: { id: "promise-1" } });
  });

  it("loads a case and records a call with an idempotency key", async () => {
    render(<Recovery />);
    fireEvent.click(await screen.findByRole("button", { name: /Mahesh Store/ }));
    fireEvent.change(screen.getByPlaceholderText("What was agreed?"), { target: { value: "Will pay Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "Log call" }));
    await waitFor(() => expect(api.logRecoveryCall).toHaveBeenCalledWith("case-1", expect.objectContaining({
      outcome: "spoke_with_customer",
      notes: "Will pay Friday",
      idempotencyKey: expect.stringMatching(/^admin-call-/),
    })));
  });
});
