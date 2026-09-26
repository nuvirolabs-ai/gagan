import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import FieldPlanning from "../FieldPlanning";

vi.mock("../../api", () => ({ api: {
  staff: vi.fn(), retailers: vi.fn(), routePlans: vi.fn(), fieldTasks: vi.fn(),
  salesTargets: vi.fn(), setSalesTarget: vi.fn(), publishRoutePlan: vi.fn(),
  beatTemplates: vi.fn(), saveBeatTemplate: vi.fn(), updateBeatTemplate: vi.fn(), applyBeatTemplate: vi.fn(),
} }));

describe("Field Planning target scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.staff).mockResolvedValue({ staff: [
      { id: "rep-1", name: "Ravi", status: "active", salesRepId: "sales-rep-1", roles: [{ role: { name: "salesperson" } }] },
      { id: "manager-1", name: "Deepak", status: "active", salesRepId: null, roles: [{ role: { name: "field_manager" } }] },
    ] });
    vi.mocked(api.retailers).mockResolvedValue({ retailers: [
      { id: "store-1", name: "North Store", salesRep: { id: "sales-rep-1" } },
      { id: "store-2", name: "South Store", salesRep: { id: "other-rep" } },
    ] });
    vi.mocked(api.routePlans).mockResolvedValue({ plans: [] });
    vi.mocked(api.beatTemplates).mockResolvedValue({ templates: [] });
    vi.mocked(api.saveBeatTemplate).mockResolvedValue({ template: { id: "beat-1" } });
    vi.mocked(api.applyBeatTemplate).mockResolvedValue({ plan: { id: "plan-1", status: "draft" } });
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

  it("saves a reusable leader beat from ordered assigned-store multi-select", async () => {
    render(<FieldPlanning />);
    await screen.findByRole("option", { name: "Ravi" });
    fireEvent.change(screen.getByLabelText("Salesperson"), { target: { value: "rep-1" } });
    expect(screen.queryByRole("button", { name: "South Store" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Route name"), { target: { value: "North beat" } });
    fireEvent.click(screen.getByRole("button", { name: "North Store" }));
    fireEvent.click(screen.getByRole("button", { name: "Save beat" }));
    await waitFor(() => expect(api.saveBeatTemplate).toHaveBeenCalledWith({
      salespersonId: "rep-1", name: "North beat", stops: [{ retailerId: "store-1" }],
    }));
  });

  it("applies a saved beat to the chosen date without publishing", async () => {
    vi.mocked(api.beatTemplates).mockResolvedValue({ templates: [{
      id: "beat-1", name: "North beat", salespersonId: "rep-1", origin: "leader",
      salesperson: { name: "Ravi" }, stops: [{ retailerId: "store-1", retailer: { name: "North Store" } }],
    }] });
    render(<FieldPlanning />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
    fireEvent.click(await screen.findByRole("button", { name: "Apply to date" }));
    await waitFor(() => expect(api.applyBeatTemplate).toHaveBeenCalledWith("beat-1", {
      salespersonId: "rep-1", planDate: "2026-10-01",
    }));
    await waitFor(() => expect(api.routePlans).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-01" }));
    expect(api.publishRoutePlan).not.toHaveBeenCalled();
  });

  it("shows an occupied-date conflict without replacing the existing route", async () => {
    vi.mocked(api.beatTemplates).mockResolvedValue({ templates: [{
      id: "beat-1", name: "North beat", salespersonId: "rep-1", origin: "leader",
      salesperson: { name: "Ravi" }, stops: [{ retailerId: "store-1", retailer: { name: "North Store" } }],
    }] });
    vi.mocked(api.applyBeatTemplate).mockRejectedValue({ body: { error: "route_date_occupied" } });
    render(<FieldPlanning />);
    fireEvent.click(await screen.findByRole("button", { name: "Apply to date" }));
    expect(await screen.findByText("A route is already planned for that date.")).toBeInTheDocument();
  });
});
