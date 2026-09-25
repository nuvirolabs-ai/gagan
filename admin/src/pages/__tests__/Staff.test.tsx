import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import Staff from "../Staff";
import StaffDetail from "../StaffDetail";

vi.mock("../../api", () => ({
  api: {
    staff: vi.fn(),
    roles: vi.fn(),
    createStaff: vi.fn(),
    setStaffStatus: vi.fn(),
    assignStaffRole: vi.fn(),
    removeStaffRole: vi.fn(),
    createDelegation: vi.fn(),
    revokeDelegation: vi.fn(),
    collectionAssignments: vi.fn(),
    collectionAssignmentRetailers: vi.fn(),
    assignCollectionRetailer: vi.fn(),
    unassignCollectionRetailer: vi.fn(),
    setupSellingLeader: vi.fn(),
    setupManagerOnly: vi.fn(),
    createSellingLeader: vi.fn(),
  },
}));

const salesperson = {
  id: "role-sales",
  name: "salesperson",
  description: "Manages assigned retailers.",
  permissions: [],
};
const coordinator = {
  id: "role-coordinate",
  name: "sales_coordinator",
  description: "Approves second invoices.",
  permissions: [],
};
const fieldManager = {
  id: "role-manager", name: "field_manager", description: "Manages field reports.", permissions: [],
};

const staff = [
  {
    id: "staff-ravi",
    name: "Ravi Kumar",
    phone: "+919876543210",
    email: "ravi@example.com",
    employeeRef: "SALES-01",
    status: "active",
    roles: [{ role: salesperson }],
    delegationsHeld: [],
  },
  {
    id: "staff-meera",
    name: "Meera Shah",
    phone: "+919812345678",
    email: "meera@example.com",
    employeeRef: "CREDIT-02",
    status: "active",
    roles: [{ role: coordinator }],
    delegationsHeld: [],
  },
];

describe("staff administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.staff).mockResolvedValue({ staff });
    vi.mocked(api.roles).mockResolvedValue({ roles: [salesperson, coordinator] });
    vi.mocked(api.createStaff).mockResolvedValue({ staff: { id: "staff-new" } });
    vi.mocked(api.setStaffStatus).mockResolvedValue({ staff: { ...staff[0], status: "suspended" } });
    vi.mocked(api.assignStaffRole).mockResolvedValue({});
    vi.mocked(api.createDelegation).mockResolvedValue({ delegation: { id: "delegate-1" } });
    vi.mocked(api.collectionAssignments).mockResolvedValue({ assignments: [] });
    vi.mocked(api.collectionAssignmentRetailers).mockResolvedValue({ retailers: [] });
    vi.mocked(api.assignCollectionRetailer).mockResolvedValue({});
    vi.mocked(api.unassignCollectionRetailer).mockResolvedValue({});
    vi.mocked(api.setupSellingLeader).mockResolvedValue({ staff: { id: "staff-ravi", salesRepId: "rep-ravi" }, roles: ["salesperson", "field_manager"] });
    vi.mocked(api.setupManagerOnly).mockResolvedValue({ staff: { id: "staff-ravi", salesRepId: "rep-ravi" }, workspaceMode: "manager_only" });
    vi.mocked(api.createSellingLeader).mockResolvedValue({ staff: { id: "staff-new", salesRepId: "rep-new" } });
  });

  it("creates a staff identity from the focused staff list", async () => {
    render(
      <MemoryRouter>
        <Staff />
      </MemoryRouter>
    );

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add staff member" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9999999999" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "asha@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Create staff member" }));

    await waitFor(() =>
      expect(api.createStaff).toHaveBeenCalledWith({
        name: "Asha Rao",
        phone: "9999999999",
        email: "asha@example.com",
        employeeRef: undefined,
      })
    );
  });

  it("creates a selling Sales Leader through one guided request", async () => {
    render(<MemoryRouter><Staff /></MemoryRouter>);
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add staff member" }));
    fireEvent.change(screen.getByLabelText("Setup"), { target: { value: "selling_leader" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "9999999999" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByLabelText("Reports to"), { target: { value: "staff-ravi" } });
    fireEvent.click(screen.getByRole("button", { name: "Create selling Sales Leader" }));
    await waitFor(() => expect(api.createSellingLeader).toHaveBeenCalledWith({
      newStaff: { name: "Asha Rao", phone: "9999999999", email: "asha@example.com", employeeRef: undefined },
      managerId: "staff-ravi",
    }));
    expect(api.createStaff).not.toHaveBeenCalled();
  });

  it("assigns a role, suspends access, and delegates bounded authority", async () => {
    render(
      <MemoryRouter initialEntries={["/staff/staff-ravi"]}>
        <Routes>
          <Route path="/staff/:staffId" element={<StaffDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Ravi Kumar" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add role"), { target: { value: "role-coordinate" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign role" }));
    await waitFor(() =>
      expect(api.assignStaffRole).toHaveBeenCalledWith("staff-ravi", "role-coordinate")
    );

    const suspendButton = screen.getByRole("button", { name: "Suspend access" });
    await waitFor(() => expect(suspendButton).toBeEnabled());
    fireEvent.click(suspendButton);
    await waitFor(() =>
      expect(api.setStaffStatus).toHaveBeenCalledWith("staff-ravi", "suspended")
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Authority owner")).toBeEnabled()
    );
    fireEvent.change(screen.getByLabelText("Authority owner"), { target: { value: "staff-meera" } });
    fireEvent.change(screen.getByLabelText("Delegated role"), { target: { value: "role-coordinate" } });
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-08-20T10:00" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2026-08-21T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Delegate authority" }));

    await waitFor(() =>
      expect(api.createDelegation).toHaveBeenCalledWith(
        "staff-ravi",
        expect.objectContaining({
          delegatorStaffId: "staff-meera",
          roleId: "role-coordinate",
        })
      )
    );
  });

  it("offers atomic selling leader setup with explicit reports and manager-only choice", async () => {
    vi.mocked(api.roles).mockResolvedValue({ roles: [salesperson, fieldManager] });
    vi.mocked(api.staff).mockResolvedValue({ staff: [
      { ...staff[0], salesRepId: null, roles: [{ role: salesperson }], directReports: [] },
      { ...staff[1], directReports: [] },
    ] });
    render(
      <MemoryRouter initialEntries={["/staff/staff-ravi"]}>
        <Routes><Route path="/staff/:staffId" element={<StaffDetail />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/salesperson identity needs setup/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Meera Shah reports to Ravi Kumar"));
    fireEvent.click(screen.getByRole("button", { name: "Set up selling Sales Leader" }));
    await waitFor(() => expect(api.setupSellingLeader).toHaveBeenCalledWith("staff-ravi", { reportIds: ["staff-meera"] }));
    fireEvent.click(screen.getByRole("button", { name: "Set up manager only" }));
    await waitFor(() => expect(api.setupManagerOnly).toHaveBeenCalledWith("staff-ravi"));
  });

  it("lets Admin grant and revoke retailer collection access for an authorized collector", async () => {
    const assignedCollectorRole = {
      id: "role-collector",
      name: "field_collector",
      description: "Manages assigned retailers.",
    };
    const fieldCollectorCatalog = {
      ...assignedCollectorRole,
      permissions: [{ permission: { name: "collection.submit" } }],
    };
    vi.mocked(api.staff).mockResolvedValue({
      staff: [{ ...staff[0], roles: [{ role: assignedCollectorRole }] }],
    });
    vi.mocked(api.roles).mockResolvedValue({ roles: [fieldCollectorCatalog, coordinator] });
    vi.mocked(api.collectionAssignments).mockResolvedValue({
      assignments: [{ id: "assignment-1", active: true, retailer: { id: "retailer-north", name: "North Star Retail", phone: "9876543210" } }],
    });
    vi.mocked(api.collectionAssignmentRetailers).mockResolvedValue({
      retailers: [{ id: "retailer-south", name: "South Star Retail", phone: "9876543211" }],
    });

    render(
      <MemoryRouter initialEntries={["/staff/staff-ravi"]}>
        <Routes>
          <Route path="/staff/:staffId" element={<StaffDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Collection rights" })).toBeInTheDocument();
    expect(await screen.findByText("North Star Retail")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search retailers"), { target: { value: "South Star" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(api.collectionAssignmentRetailers).toHaveBeenLastCalledWith("staff-ravi", "South Star"));
    fireEvent.change(screen.getByLabelText("Retailer to assign"), { target: { value: "retailer-south" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign retailer" }));
    await waitFor(() => expect(api.assignCollectionRetailer).toHaveBeenCalledWith("staff-ravi", "retailer-south"));
    await waitFor(() => expect(api.collectionAssignmentRetailers).toHaveBeenLastCalledWith("staff-ravi", "South Star"));

    fireEvent.click(screen.getByRole("button", { name: "Remove North Star Retail" }));
    await waitFor(() => expect(api.unassignCollectionRetailer).toHaveBeenCalledWith("assignment-1"));
  });
});
