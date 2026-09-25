import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Retailers from "../Retailers";

const mocks = vi.hoisted(() => ({ retailers: vi.fn(), tiers: vi.fn(), setInternalSegment: vi.fn(), fieldRetailerMarketingHistory: vi.fn() }));
const auth = vi.hoisted(() => ({ permissions: ["route.manage"] as string[] }));
vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return { ...actual, api: { ...actual.api, ...mocks } };
});
vi.mock("../../useAuth", () => ({ useAuth: () => auth }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retailers.mockResolvedValue({ retailers: [{
    id: "retailer-1",
    name: "North Star Retail",
    phone: "9876543210",
    deliveryCity: "Pune",
    internalSegment: null,
    tier: { id: "tier-1", name: "Gold" },
    creditLimit: 10000,
    currentBalance: 2000,
    overdueAmount: 0,
    available: 8000,
  }] });
  mocks.tiers.mockResolvedValue({ tiers: [{ id: "tier-1", name: "Gold" }] });
  mocks.setInternalSegment.mockResolvedValue({ retailer: { id: "retailer-1", internalSegment: "A" } });
  mocks.fieldRetailerMarketingHistory.mockResolvedValue({ executions: [{
    task: { id: "task-1", title: "Shelf display", status: "done", completedAt: "2026-09-24T10:00:00.000Z" },
    salesperson: { id: "staff-1", name: "Ravi Kumar" },
    evidence: [{ id: "evidence-1", signedUrl: "https://signed.example/photo" }],
  }] });
  auth.permissions = ["route.manage"];
});

describe("retailer internal segment administration", () => {
  it("updates the internal segment without changing the pricing tier control", async () => {
    render(
      <MemoryRouter>
        <Retailers />
      </MemoryRouter>
    );

    expect(await screen.findByText("North Star Retail")).toBeInTheDocument();
    const segment = screen.getByLabelText("Internal segment for North Star Retail");
    expect(segment).toHaveValue("");
    fireEvent.change(segment, { target: { value: "A" } });

    await waitFor(() => expect(mocks.setInternalSegment).toHaveBeenCalledWith("retailer-1", "A"));
    expect(screen.getByLabelText("Commercial pricing tier for North Star Retail")).toHaveValue("tier-1");
  });

  it("loads scoped execution history and reveals photos only when expanded", async () => {
    render(<MemoryRouter><Retailers /></MemoryRouter>);

    await screen.findByText("North Star Retail");
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByText("Shelf display")).toBeInTheDocument();
    expect(mocks.fieldRetailerMarketingHistory).toHaveBeenCalledWith("retailer-1");
    expect(screen.queryByRole("img", { name: "Shelf display evidence" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View photos (1)" }));
    expect(screen.getByRole("img", { name: "Shelf display evidence" })).toHaveAttribute("src", "https://signed.example/photo");
  });

  it("hides history from admins without route-management permission", async () => {
    auth.permissions = ["dashboard.view"];
    render(<MemoryRouter><Retailers /></MemoryRouter>);

    await screen.findByText("North Star Retail");
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
    expect(mocks.fieldRetailerMarketingHistory).not.toHaveBeenCalled();
  });
});
