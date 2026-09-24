import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Collections from "../Collections";

const mocks = vi.hoisted(() => ({
  collections: vi.fn(),
  requestAdminStepUp: vi.fn(),
  completeAdminStepUp: vi.fn(),
  confirmCollection: vi.fn(),
  rejectCollection: vi.fn(),
}));

vi.mock("../../api", () => ({ api: mocks, inr: (value: number) => `₹${Number(value).toFixed(2)}` }));

const submission = {
  id: "collection-1",
  amount: "100.00",
  method: "cheque",
  reference: "CHQ-2026-001",
  notes: "Collected at the retailer counter",
  status: "pending",
  submittedAt: "2026-09-25T08:30:00.000Z",
  collectorName: "Asha Verma",
  retailer: { name: "North Star Retail", phone: "9876543210" },
  invoiceScopeId: "invoice-1",
  jainAmount: "60.00",
  padamAmount: "40.00",
  evidence: [{ contentType: "image/jpeg", signedUrl: "https://storage.invalid/receipt" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collections.mockResolvedValue({ submissions: [submission] });
});

describe("Admin collection inspection", () => {
  it("shows collector, submission status, notes, reference, entity split and proof", async () => {
    render(<Collections />);

    fireEvent.click(await screen.findByRole("button", { name: /North Star Retail/ }));
    expect(screen.getAllByText(/Collected by Asha Verma/)).toHaveLength(2);
    expect(screen.getByText(/Status: Pending/)).toBeInTheDocument();
    expect(screen.getByText("Notes: Collected at the retailer counter")).toBeInTheDocument();
    expect(screen.getByText("Reference: CHQ-2026-001")).toBeInTheDocument();
    expect(screen.getByText(/Invoice invoice-1 · Jain ₹60.00 · Padam ₹40.00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open receipt evidence" })).toHaveAttribute("href", submission.evidence[0].signedUrl);
  });
});
