import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Legal from "../Legal";

vi.mock("../../api", () => ({
  api: {
    recoveryCases: vi.fn(),
    recoveryTimeline: vi.fn(),
    createRecoveryLetter: vi.fn(),
    recordRecoveryDelivery: vi.fn(),
    createLegalCase: vi.fn(),
    decideLegalCase: vi.fn(),
  },
  inr: (amount: number) => `₹${amount}`,
}));

const recoveryCase = {
  id: "case-1",
  retailer: { name: "Mahesh Store" },
  invoice: { invoiceNumber: 1007, outstandingAmount: 12_500 },
  actions: [],
};

describe("legal recovery operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.recoveryCases).mockResolvedValue({ cases: [recoveryCase] });
    vi.mocked(api.recoveryTimeline).mockResolvedValue({ recoveryCase: { letters: [], legalCase: null }, events: [] });
    vi.mocked(api.createRecoveryLetter).mockResolvedValue({ letter: { id: "letter-1", objectKey: "recovery-letter/1", signedUrl: "signed://letter-1", sentAt: "2026-08-21" } });
    vi.mocked(api.recordRecoveryDelivery).mockResolvedValue({ delivery: { id: "delivery-1" } });
    vi.mocked(api.createLegalCase).mockResolvedValue({ legalCase: { id: "legal-1", status: "open" } });
    vi.mocked(api.decideLegalCase).mockResolvedValue({ legalCase: { id: "legal-1", status: "settled" } });
  });

  it("generates a letter and explicitly creates a legal referral", async () => {
    render(<Legal />);
    fireEvent.click(await screen.findByRole("button", { name: /Mahesh Store/ }));
    fireEvent.click(screen.getByRole("button", { name: "Generate recovery letter" }));
    await waitFor(() => expect(api.createRecoveryLetter).toHaveBeenCalledWith("case-1", expect.objectContaining({ idempotencyKey: expect.stringMatching(/^letter-/) })));
    fireEvent.change(screen.getByLabelText("Legal referral reason"), { target: { value: "No response after notice" } });
    fireEvent.click(screen.getByRole("button", { name: "Refer to legal" }));
    await waitFor(() => expect(api.createLegalCase).toHaveBeenCalledWith("case-1", expect.objectContaining({ letterId: "letter-1", reason: "No response after notice" })));
  });
});
