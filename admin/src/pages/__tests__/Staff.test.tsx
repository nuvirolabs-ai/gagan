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
});
