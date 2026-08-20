import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Corrections from "../Corrections";

vi.mock("../../api", () => ({
  api: {
    correctionTargets: vi.fn(),
    issueCreditNote: vi.fn(),
    reversePayment: vi.fn(),
  },
  inr: (amount: number) => `₹${amount}`,
}));

describe("financial corrections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.correctionTargets).mockResolvedValue({
      retailers: [
        {
          id: "retailer-1",
          name: "Sharma Stores",
          currentBalance: 400,
          invoices: [
            {
              id: "invoice-1",
              invoiceNumber: 12,
              total: 500,
              outstandingAmount: 400,
              creditableAmount: 500,
              status: "partially_paid",
              invoiceDate: "2026-08-01T00:00:00.000Z",
            },
          ],
          payments: [
            {
              id: "payment-1",
              amount: 300,
              reversibleAmount: 300,
              channel: "online",
              providerRef: "pay-1",
              settledAt: "2026-08-20T09:00:00.000Z",
            },
          ],
        },
      ],
    });
    vi.mocked(api.issueCreditNote).mockResolvedValue({ creditNote: { id: "credit-1" } });
    vi.mocked(api.reversePayment).mockResolvedValue({
      paymentReversal: { id: "reversal-1" },
    });
  });

  it("issues a reasoned credit note from a focused confirmation form", async () => {
    render(<Corrections />);

    expect(await screen.findByRole("heading", { name: "Financial corrections" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Credit amount"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Credit reason"), {
      target: { value: "Verified delivery shortage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review and issue" }));

    expect(screen.getByText("Issue a ₹100 credit note for Invoice #12?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm credit note" }));

    expect(
      await screen.findByText("Credit note issued. The original invoice remains unchanged.")
    ).toBeInTheDocument();
    expect(api.issueCreditNote).toHaveBeenCalledWith(
      "invoice-1",
      100,
      "Verified delivery shortage",
      expect.any(String)
    );
    await waitFor(() => expect(api.correctionTargets).toHaveBeenCalledTimes(2));
  });
});
