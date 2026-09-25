import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Dashboard from "../Dashboard";

vi.mock("../../useAuth", () => ({
  useAuth: () => ({ admin: { name: "Ops Admin" } }),
}));

vi.mock("../../api", () => ({
  api: {
    orders: vi.fn(async (status: string) => ({
      orders: status === "placed" ? [{ id: "o1" }, { id: "o2" }] : [],
    })),
    approvals: vi.fn(async () => ({ requests: [{ id: "a1" }] })),
    collections: vi.fn(async () => ({ submissions: [] })),
    retailerProposals: vi.fn(async () => ({ proposals: [{ id: "p1" }] })),
    fieldExpenses: vi.fn(async () => ({ expenses: [] })),
    serviceIssues: vi.fn(async () => ({ issues: [] })),
    leaveRequests: vi.fn(async () => ({ requests: [] })),
    sapStatus: vi.fn(async () => ({ outbox: { failed: 2 } })),
  },
}));

describe("work home", () => {
  it("shows live queues that need an employee, not vanity metrics", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Ops/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Orders need credit / confirmation")).toBeInTheDocument());
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Credit holds")).toBeInTheDocument();
    expect(screen.getByText("SAP outbox failures")).toBeInTheDocument();
    expect(screen.queryByText("CloudRest Memory Pillow")).not.toBeInTheDocument();
    expect(screen.queryByText("AeroFlex Running Shoes")).not.toBeInTheDocument();
  });
});
