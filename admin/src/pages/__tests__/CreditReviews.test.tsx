import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import CreditReviews from "../CreditReviews";

vi.mock("../../api", () => ({ api: {
  ratingProposals: vi.fn(), shadowComparisons: vi.fn(), kycPending: vi.fn(), confirmKyc: vi.fn(), requestAdminStepUp: vi.fn(), completeAdminStepUp: vi.fn(), confirmRatingProposal: vi.fn(),
} }));

describe("credit rating reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.ratingProposals).mockResolvedValue({ proposals: [{
      id: "proposal-1", previousRating: "N", proposedRating: "A", trigger: "quarterly_checkpoint",
      evidence: { averageDso: 28, cleanInvoiceCount: 3 },
      creditProfile: { retailer: { name: "Mahesh Store" } },
    }] });
    vi.mocked(api.shadowComparisons).mockResolvedValue({ comparisons: [] });
    vi.mocked(api.kycPending).mockResolvedValue({ profiles: [] });
    vi.mocked(api.requestAdminStepUp).mockResolvedValue({ challengeId: "challenge-1" });
    vi.mocked(api.completeAdminStepUp).mockResolvedValue({ accessToken: "elevated" });
    vi.mocked(api.confirmRatingProposal).mockResolvedValue({});
  });

  it("step-up confirms an evidence-backed rating change", async () => {
    render(<CreditReviews />);
    expect(await screen.findByText("N → A")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Confirmation reason"), { target: { value: "Quarterly evidence verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm rating" }));
    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and confirm" }));
    await waitFor(() => expect(api.confirmRatingProposal).toHaveBeenCalledWith("proposal-1", "Quarterly evidence verified"));
  });
});
