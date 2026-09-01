import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SalesLeader from "../SalesLeader";

const { salesLeader } = vi.hoisted(() => ({
  salesLeader: vi.fn().mockResolvedValue({
    period: { from: "2026-09-01", to: "2026-09-30" },
    sellingDays: { total: 26, elapsed: 10, remaining: 16 },
    team: {
      salespeople: 2,
      target: 600000,
      actual: 200000,
      completionPct: 33,
      projection: { projected: 520000, perDay: 20000, label: "Projected at current run rate" },
      risk: { level: "at_risk", projectedAchievementPct: 87, reasons: [] },
      present: 1,
      visits: 60,
      productiveOutlets: 28,
      orders: 17,
      collections: 60000,
      newRetailers: 3,
    },
    members: [
      {
        salespersonId: "s1",
        name: "Anil",
        attendance: "present",
        rank: 1,
        actuals: { order_value: 150000 },
        headlineTarget: { metric: "order_value", target: 300000, actual: 150000, completionPct: 50 },
        projection: { projected: 390000, perDay: 15000, label: "Projected at current run rate" },
        risk: { level: "on_track", projectedAchievementPct: 130, reasons: [] },
        route: { completionPct: 80, visited: 4, total: 5 },
      },
      {
        salespersonId: "s2",
        name: "Bela",
        attendance: "absent",
        rank: 2,
        actuals: { order_value: 50000 },
        headlineTarget: { metric: "order_value", target: 300000, actual: 50000, completionPct: 17 },
        projection: { projected: 130000, perDay: 5000, label: "Projected at current run rate" },
        risk: {
          level: "at_risk",
          projectedAchievementPct: 43,
          reasons: ["projected at current run rate: 43% of target.", "Not marked present today."],
        },
        route: { completionPct: 40, visited: 2, total: 5 },
      },
    ],
    leaderboard: {
      metric: "target_achievement_pct",
      metricLabel: "Target achieved",
      metricReason: "2 of 2 carry a target this period.",
      entries: [
        { salespersonId: "s1", name: "Anil", value: 50, rank: 1, previousRank: 3 },
        { salespersonId: "s2", name: "Bela", value: 17, rank: 2, previousRank: 1 },
      ],
    },
    recommendedActions: [
      {
        type: "COACH_AT_RISK",
        salespersonId: "s2",
        salespersonName: "Bela",
        action: "Call Bela",
        why: "projected at current run rate: 43% of target.",
        priority: 86,
      },
    ],
  }),
}));

vi.mock("../../api", () => ({
  inr: (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`,
  api: { salesLeader },
}));

describe("Sales leader dashboard", () => {
  it("shows the team's target, achievement and projection", async () => {
    render(<SalesLeader />);
    expect(await screen.findByText("₹6,00,000")).toBeInTheDocument();
    expect(screen.getByText("₹5,20,000")).toBeInTheDocument();
    // The projection is always labelled as a run rate, never as a promise.
    expect(screen.getAllByText(/Projected at current run rate/i).length).toBeGreaterThan(0);
  });

  it("never claims anyone will achieve their target", async () => {
    const { container } = render(<SalesLeader />);
    await screen.findByText("₹6,00,000");
    expect(container.textContent).not.toMatch(/will achieve|guaranteed|certain/i);
  });

  it("names who is at risk and the measurement behind it", async () => {
    render(<SalesLeader />);
    expect(await screen.findByText(/At risk \(1\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/projected at current run rate: 43% of target\. Not marked present today\./)
    ).toBeInTheDocument();
  });

  it("shows beat completion per salesperson", async () => {
    render(<SalesLeader />);
    await screen.findByText("Anil");
    expect(screen.getByText("2/5 · 40%")).toBeInTheDocument();
  });

  it("explains which metric the leaderboard ranks on", async () => {
    render(<SalesLeader />);
    await screen.findByText("Anil");
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));
    expect(await screen.findByText("2 of 2 carry a target this period.")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("gives every recommended action a reason", async () => {
    render(<SalesLeader />);
    await screen.findByText("Anil");
    fireEvent.click(screen.getByRole("button", { name: /Recommended actions/ }));
    expect(await screen.findByText("Call Bela")).toBeInTheDocument();
    expect(
      screen.getByText("projected at current run rate: 43% of target.")
    ).toBeInTheDocument();
  });

  it("re-reads when a territory is applied", async () => {
    render(<SalesLeader />);
    await screen.findByText("Anil");
    fireEvent.change(screen.getByPlaceholderText("Pune North"), {
      target: { value: "Pune South" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(salesLeader).toHaveBeenCalledWith("Pune South"));
  });
});
