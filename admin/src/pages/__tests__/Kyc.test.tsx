import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Kyc from "../Kyc";

vi.mock("../../api", () => ({ api: {
  kycCases: vi.fn(), retailers: vi.fn(), startKyc: vi.fn(), kycCase: vi.fn(), uploadKycDocument: vi.fn(), submitKyc: vi.fn(), requestAdminStepUp: vi.fn(), completeAdminStepUp: vi.fn(), approveKycCase: vi.fn(), rejectKycCase: vi.fn(),
} }));

describe("KYC admin queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.kycCases).mockResolvedValue({ cases: [{ id: "case-1", status: "submitted", retailer: { name: "Mahesh Store", phone: "9999999999" }, documents: [{ type: "identity_proof" }] }] });
    vi.mocked(api.retailers).mockResolvedValue({ retailers: [{ id: "retailer-1", name: "Mahesh Store", phone: "9999999999" }] });
    vi.mocked(api.requestAdminStepUp).mockResolvedValue({ challengeId: "challenge-1" });
    vi.mocked(api.completeAdminStepUp).mockResolvedValue({ accessToken: "elevated" });
    vi.mocked(api.approveKycCase).mockResolvedValue({ kycCase: { id: "case-1", status: "approved", documents: [], retailer: { name: "Mahesh Store" } } });
  });

  it("requires step-up before approving a submitted case", async () => {
    render(<Kyc />);
    fireEvent.click(await screen.findByRole("button", { name: /Mahesh Store/ }));
    fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: "Documents verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve KYC" }));
    expect(await screen.findByLabelText("Six-digit code")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and approve" }));
    await waitFor(() => expect(api.completeAdminStepUp).toHaveBeenCalledWith("challenge-1", "123456"));
    await waitFor(() => expect(api.approveKycCase).toHaveBeenCalledWith("case-1", "Documents verified"));
  });
});
