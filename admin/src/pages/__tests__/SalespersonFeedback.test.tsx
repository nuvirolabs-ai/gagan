import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SalespersonFeedback from "../SalespersonFeedback";
import { api } from "../../api";

vi.mock("../../api", () => ({ api: { salespersonFeedback: vi.fn().mockResolvedValue({ feedback: [{
  id: "feedback-a", retailerId: "retailer-a", retailer: { name: "Mahesh Store" },
  salesRepId: "rep-a", salesRep: { name: "Ravi Kumar" },
  description: "Helpful shop visit", createdAt: "2026-09-26T10:00:00.000Z",
}], nextCursor: null }) } }));

describe("Salesperson feedback review", () => {
  it("shows retailer actor, salesperson subject and feedback without an issue action", async () => {
    render(<SalespersonFeedback />);
    expect(await screen.findByText("Mahesh Store")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Helpful shop visit")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolve|close|reject/i })).not.toBeInTheDocument();
  });

  it("loads subsequent review pages", async () => {
    vi.mocked(api.salespersonFeedback)
      .mockResolvedValueOnce({ feedback: [{ id: "one", retailer: { name: "First Store" }, salesRep: { name: "Ravi" }, description: "First", createdAt: "2026-09-26T10:00:00Z" }], nextCursor: "page-two" } as any)
      .mockResolvedValueOnce({ feedback: [{ id: "two", retailer: { name: "Second Store" }, salesRep: { name: "Sunil" }, description: "Second", createdAt: "2026-09-25T10:00:00Z" }], nextCursor: null } as any);
    render(<SalespersonFeedback />);
    expect(await screen.findByText("First Store")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second Store")).toBeInTheDocument();
    expect(api.salespersonFeedback).toHaveBeenCalledWith("page-two");
  });

  it("does not describe a failed initial load as an empty review scope", async () => {
    vi.mocked(api.salespersonFeedback).mockRejectedValueOnce(new Error("offline"));
    render(<SalespersonFeedback />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No feedback in your review scope.")).not.toBeInTheDocument();
  });
});
