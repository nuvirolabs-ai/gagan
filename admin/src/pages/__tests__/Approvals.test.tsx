import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Approvals from "../Approvals";

vi.mock("../../api", () => ({
  api: {
    approvals: vi.fn(),
    approval: vi.fn(),
    requestAdminStepUp: vi.fn(),
    completeAdminStepUp: vi.fn(),
    decideApproval: vi.fn(),
  },
  inr: (amount: number) => `₹${amount}`,
}));

const queueItem = {
  id: "approval-1",
  approvalType: "second_invoice",
  requiredPermission: "approval.second_invoice",
  status: "open",
  deadlineAt: null,
  retailer: { id: "retailer-1", name: "Mahesh Store" },
  order: { id: "order-1", orderNo: 41, orderTotal: 20_000, createdAt: "2026-08-20" },
  assessment: { reasons: ["new_customer_second_invoice"], projectedExposure: 35_000 },
};

describe("shared admin approval queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.approvals).mockResolvedValue({ requests: [queueItem] });
    vi.mocked(api.approval).mockResolvedValue({ request: queueItem });
    vi.mocked(api.requestAdminStepUp).mockResolvedValue({ challengeId: "challenge-1" });
    vi.mocked(api.completeAdminStepUp).mockResolvedValue({ accessToken: "elevated" });
    vi.mocked(api.decideApproval).mockResolvedValue({ request: { ...queueItem, status: "approved" } });
  });

  it("shows reason-coded exposure and uses OTP step-up before approval", async () => {
    render(<Approvals />);
    fireEvent.click(await screen.findByRole("button", { name: /Mahesh Store/ }));

    expect(await screen.findByText("Second invoice approval")).toBeInTheDocument();
    expect(screen.getByText("₹35000 projected exposure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve order" }));
    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
    expect(api.requestAdminStepUp).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and approve" }));
    await waitFor(() => expect(api.completeAdminStepUp).toHaveBeenCalledWith("challenge-1", "123456"));
    await waitFor(() => expect(api.decideApproval).toHaveBeenCalledWith("approval-1", "approved", undefined));
  });
});
