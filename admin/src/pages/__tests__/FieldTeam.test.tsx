import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FieldTeam from "../FieldTeam";

const { decideLeave } = vi.hoisted(() => ({ decideLeave: vi.fn().mockResolvedValue({}) }));

vi.mock("../../api", () => ({
  inr: (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`,
  api: {
    fieldTeam: vi.fn().mockResolvedValue({
      members: [
        {
          salespersonId: "staff-1",
          name: "Ravi Kumar",
          territory: "Pune North",
          mark: "present",
          workedMinutes: 275,
          metrics: { visits: 6, orders: 3, orderValue: 84000 },
          route: { id: "plan-1", status: "published", progress: { visited: 4, skipped: 1, total: 8, completionPct: 63 } },
        },
      ],
    }),
    leaveRequests: vi.fn().mockResolvedValue({
      requests: [
        {
          id: "leave-1",
          salesperson: { name: "Ravi Kumar" },
          fromDate: "2026-03-10T00:00:00.000Z",
          toDate: "2026-03-11T00:00:00.000Z",
          type: "casual",
          reason: "Family function",
          status: "pending",
        },
      ],
    }),
    liveFieldPositions: vi.fn().mockResolvedValue({ salespeople: [] }),
    decideLeave,
  },
}));

describe("Field team", () => {
  it("shows attendance, hours and route progress from real metrics", async () => {
    render(<FieldTeam />);
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getByText("4h 35m")).toBeInTheDocument();
    expect(screen.getByText("5/8 · 63%")).toBeInTheDocument();
    expect(screen.getByText("₹84,000")).toBeInTheDocument();
  });

  it("says plainly that nobody off duty is tracked", async () => {
    render(<FieldTeam />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByRole("button", { name: /On duty now/ }));
    expect(
      await screen.findByText(/Nobody has an open workday right now/)
    ).toBeInTheDocument();
  });

  it("sends a leave decision as the reviewing admin", async () => {
    render(<FieldTeam />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByRole("button", { name: /Leave \(1\)/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(decideLeave).toHaveBeenCalledWith("leave-1", "approved", undefined)
    );
  });
});
