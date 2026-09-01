import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RetailerApprovals from "../RetailerApprovals";

const { approveRetailerProposal, rejectRetailerProposal } = vi.hoisted(() => ({
  approveRetailerProposal: vi.fn().mockResolvedValue({}),
  rejectRetailerProposal: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api", () => ({
  api: {
    retailerProposals: vi.fn().mockResolvedValue({
      proposals: [
        {
          id: "proposal-1",
          businessName: "New Bharat Kirana",
          ownerName: "Suresh",
          phone: "9812345678",
          shopAddress: "44 Market Road, Pune",
          latitude: "18.5167000",
          longitude: "73.8562000",
          notes: "Buys weekly",
          status: "pending",
          submittedBy: { id: "s1", name: "Ravi Kumar" },
        },
      ],
    }),
    tiers: vi.fn().mockResolvedValue({ tiers: [{ id: "tier-1", name: "Gold" }] }),
    approveRetailerProposal,
    rejectRetailerProposal,
  },
}));

describe("New retailer approvals", () => {
  it("shows the store, who proposed it and where it was pinned", async () => {
    render(<RetailerApprovals />);
    expect(await screen.findByText("New Bharat Kirana")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("18.51670, 73.85620")).toBeInTheDocument();
  });

  it("admits the store to the customer master on approval", async () => {
    render(<RetailerApprovals />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(approveRetailerProposal).toHaveBeenCalledWith("proposal-1", undefined)
    );
    expect(
      await screen.findByText(/It starts at pending KYC/)
    ).toBeInTheDocument();
  });

  it("applies the tier the reviewer chose rather than the proposed one", async () => {
    render(<RetailerApprovals />);
    await screen.findByText("New Bharat Kirana");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "tier-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(approveRetailerProposal).toHaveBeenCalledWith("proposal-1", "tier-1")
    );
  });

  it("explains an API refusal in words a reviewer can act on", async () => {
    approveRetailerProposal.mockRejectedValueOnce(new Error("tier_required"));
    render(<RetailerApprovals />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(
      await screen.findByText(/Choose a tier to apply/)
    ).toBeInTheDocument();
  });

  it("refuses to reject without telling the salesperson why", async () => {
    render(<RetailerApprovals />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(
      await screen.findByText("Give the salesperson a reason before rejecting.")
    ).toBeInTheDocument();
    expect(rejectRetailerProposal).not.toHaveBeenCalled();
  });

  it("rejects with the reason once one is given", async () => {
    render(<RetailerApprovals />);
    await screen.findByText("New Bharat Kirana");
    fireEvent.change(screen.getByPlaceholderText(/Already served/), {
      target: { value: "Already served under another account" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(rejectRetailerProposal).toHaveBeenCalledWith(
        "proposal-1",
        "Already served under another account"
      )
    );
  });
});
