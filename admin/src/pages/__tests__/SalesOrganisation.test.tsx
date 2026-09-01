import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SalesOrganisation from "../SalesOrganisation";

const { orgTree, orgUnassigned, orgStaff, orgEligibleManagers, setOrgManager } = vi.hoisted(() => ({
  orgTree: vi.fn().mockResolvedValue({
    nodes: [
      { id: "n1", name: "Nita", managerId: null, status: "active", depth: 0, reportCount: 1 },
      { id: "r1", name: "Ravi", managerId: "n1", status: "active", depth: 1, reportCount: 1 },
      { id: "p1", name: "Priya", managerId: "r1", status: "active", depth: 2, reportCount: 0 },
    ],
  }),
  orgUnassigned: vi.fn().mockResolvedValue({
    staff: [{ id: "u1", name: "Unplaced Person", status: "active" }],
  }),
  orgStaff: vi.fn().mockResolvedValue({
    staff: { id: "p1", name: "Priya", status: "active", managerId: "r1" },
    managementChain: [
      { id: "r1", name: "Ravi", depth: 1 },
      { id: "n1", name: "Nita", depth: 2 },
    ],
    directReports: [],
    teamSize: 0,
    history: [
      {
        id: "h1",
        changedAt: "2026-08-01T00:00:00.000Z",
        changedById: "n1",
        changedByName: "Nita",
        previousManagerId: null,
        previousManagerName: null,
        newManagerId: "r1",
        newManagerName: "Ravi",
        reason: "Joined the West beat",
      },
    ],
  }),
  orgEligibleManagers: vi.fn().mockResolvedValue({
    managers: [
      { id: "n1", name: "Nita" },
      { id: "r1", name: "Ravi" },
    ],
  }),
  setOrgManager: vi.fn().mockResolvedValue({ changed: true }),
}));

vi.mock("../../api", () => ({
  api: { orgTree, orgUnassigned, orgStaff, orgEligibleManagers, setOrgManager },
}));

const show = () => render(<SalesOrganisation />, { wrapper: MemoryRouter });

describe("Sales organisation", () => {
  it("renders the whole chart as an indented list", async () => {
    show();
    expect(await screen.findByText("Nita")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("Priya")).toBeInTheDocument();
  });

  it("surfaces people who are not in the chart yet", async () => {
    show();
    expect(await screen.findByText(/Not yet placed \(1\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unplaced Person" })).toBeInTheDocument();
  });

  it("shows who someone reports up through", async () => {
    show();
    fireEvent.click(await screen.findByText("Priya"));
    await screen.findByRole("heading", { name: "Priya" });
    expect(screen.getByText("Reports up through")).toBeInTheDocument();
  });

  it("shows the reassignment history rather than only the current manager", async () => {
    show();
    fireEvent.click(await screen.findByText("Priya"));
    expect(await screen.findByText(/nobody → Ravi/)).toBeInTheDocument();
    expect(screen.getByText(/by Nita/)).toBeInTheDocument();
    expect(screen.getByText(/Joined the West beat/)).toBeInTheDocument();
  });

  it("offers only managers the server would accept", async () => {
    show();
    fireEvent.click(await screen.findByText("Priya"));
    await screen.findByRole("heading", { name: "Priya" });
    // The server excludes the person and their descendants; the page shows
    // exactly what it was given rather than every employee.
    expect(orgEligibleManagers).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("option", { name: "Nita" })).toBeInTheDocument();
  });

  it("can move somebody to the top of the tree", async () => {
    show();
    fireEvent.click(await screen.findByText("Priya"));
    await screen.findByRole("heading", { name: "Priya" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Update reporting line" }));
    await waitFor(() => expect(setOrgManager).toHaveBeenCalledWith("p1", null, undefined));
  });

  it("explains a rejected cycle in words rather than showing the code", async () => {
    setOrgManager.mockRejectedValueOnce({ body: { error: "cycle" } });
    show();
    fireEvent.click(await screen.findByText("Priya"));
    await screen.findByRole("heading", { name: "Priya" });
    fireEvent.click(screen.getByRole("button", { name: "Update reporting line" }));
    expect(
      await screen.findByText(/already reports to this person, directly or further down/)
    ).toBeInTheDocument();
    expect(screen.queryByText("cycle")).toBeNull();
  });
});
