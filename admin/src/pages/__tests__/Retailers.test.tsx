import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Retailers from "../Retailers";

vi.mock("../../api", () => ({
  api: {
    retailers: vi.fn(),
    tiers: vi.fn(),
    retailerProposals: vi.fn(),
    requestAdminStepUp: vi.fn(),
    completeAdminStepUp: vi.fn(),
    approveRetailerProposal: vi.fn(),
    rejectRetailerProposal: vi.fn(),
    createRetailer: vi.fn(),
    setTier: vi.fn(),
    setCreditLimit: vi.fn(),
  },
  inr: (n: number) => `₹${n}`,
}));

describe("retailer proposal approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.retailers).mockResolvedValue({ retailers: [] });
    vi.mocked(api.tiers).mockResolvedValue({ tiers: [] });
    vi.mocked(api.retailerProposals).mockResolvedValue({
      proposals: [{
        id: "proposal-1",
        partyName: "Sharma Kirana",
        mobile: "9876543210",
        deliveryCity: "Indore",
        grade: "B",
        creditLimit: 40000,
        paymentTermDays: 21,
        contactPerson: "Ramesh",
        address1: "14 Palasia",
        shopTenureYears: 8,
        aadhaarNumber: "123456789012",
        aadhaarPhoto: { id: "asset-1" },
        group: { name: "Kirana Independent" },
        transporter: { name: "Local Tempo Palasia" },
        salesman: { name: "Ravi Kumar" },
        buyerCategory: { name: "Retailer" },
      }],
    });
    vi.mocked(api.requestAdminStepUp).mockResolvedValue({ challengeId: "challenge-1" });
    vi.mocked(api.completeAdminStepUp).mockResolvedValue({ accessToken: "elevated" });
    vi.mocked(api.approveRetailerProposal).mockResolvedValue({ proposal: { id: "proposal-1", status: "approved" } });
  });

  it("displays the new fields and keeps approve working after step-up", async () => {
    render(<MemoryRouter><Retailers /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Sharma Kirana/ }));
    expect(await screen.findByText(/Address: 14 Palasia/)).toBeInTheDocument();
    expect(screen.getByText(/Credit limit:/)).toBeInTheDocument();
    expect(screen.getByText(/Payment terms:/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: "Shop verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve retailer" }));
    fireEvent.change(await screen.findByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and approve" }));
    await waitFor(() => expect(api.completeAdminStepUp).toHaveBeenCalledWith("challenge-1", "123456"));
    await waitFor(() => expect(api.approveRetailerProposal).toHaveBeenCalledWith("proposal-1", "Shop verified"));
  });
});
