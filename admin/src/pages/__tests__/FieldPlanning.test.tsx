import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import FieldPlanning from "../FieldPlanning";

vi.mock("../../api", () => ({ api: {
  staff: vi.fn(), retailers: vi.fn(), routePlans: vi.fn(), fieldTasks: vi.fn(),
  salesTargets: vi.fn(), setSalesTarget: vi.fn(),
} }));

describe("Field Planning target scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.staff).mockResolvedValue({ staff: [
      { id: "rep-1", name: "Ravi", status: "active", salesRepId: "sales-rep-1", roles: [{ role: { name: "salesperson" } }] },
      { id: "manager-1", name: "Deepak", status: "active", salesRepId: null, roles: [{ role: { name: "field_manager" } }] },
    ] });
    vi.mocked(api.retailers).mockResolvedValue({ retailers: [] });
    vi.mocked(api.routePlans).mockResolvedValue({ plans: [] });
    vi.mocked(api.fieldTasks).mockResolvedValue({ tasks: [] });
    vi.mocked(api.salesTargets).mockResolvedValue({ targets: [] });
    vi.mocked(api.setSalesTarget).mockResolvedValue({ target: { id: "target-1" } });
  });

  it("lists both scopes and sends an explicit TEAM zero target for a manager", async () => {
    render(<FieldPlanning />);
    fireEvent.click(await screen.findByRole("button", { name: /targets/i }));
    await waitFor(() => expect(api.salesTargets).toHaveBeenCalledWith(undefined, "all"));
    fireEvent.change(screen.getByLabelText("Target scope"), { target: { value: "TEAM" } });
    fireEvent.change(screen.getByLabelText("Target owner"), { target: { value: "manager-1" } });
    fireEvent.change(screen.getByLabelText("Target value"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save target" }));
    await waitFor(() => expect(api.setSalesTarget).toHaveBeenCalledWith(expect.objectContaining({
      salespersonId: "manager-1", scope: "TEAM", targetValue: 0,
    })));
  });
});
