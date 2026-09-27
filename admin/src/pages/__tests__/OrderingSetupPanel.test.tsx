import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrderingSetupPanel from "../OrderingSetupPanel";

const mocks = vi.hoisted(() => ({ orderingSetup: vi.fn(), saveOrderingDraft: vi.fn(), enableOrdering: vi.fn() }));
vi.mock("../../api", async original => ({ ...await original<typeof import("../../api")>(), api: mocks }));
const setup = {
  revision: "a".repeat(64), product: { name: "Gagan Excellent" },
  pack: { id: "pack-one", label: "5 KG × 4", unitWeightKg: 5, unitsPerCase: 4, caseWeightKg: 20, status: "published" },
  tiers: [{ id: "gold", name: "Gold" }], inventory: { warehouseCode: "WH-001", available: 10, status: "available", source: "staging_uat", syncedAt: "2026-09-27T10:00:00.000Z" },
  values: { gstPercent: null, sellingEntity: null, routingClass: "LAXMI_TOOR", routingBagEquivalent: null, prices: [{ tierId: "gold", rate: "4800", rateBasis: "quintal" }] },
  effective: { gstPercent: null, sellingEntity: null, routingClass: "LAXMI_TOOR", routingBagEquivalent: null, prices: [{ tierId: "gold", rate: "4800", rateBasis: "quintal" }] },
  hasDraft: false, gstPendingException: false, blockers: ["Select an approved GST rate."],
};
beforeEach(() => { vi.clearAllMocks(); mocks.orderingSetup.mockResolvedValue(setup); mocks.saveOrderingDraft.mockResolvedValue({ ...setup, hasDraft: true }); mocks.enableOrdering.mockResolvedValue({ ...setup, pack: { ...setup.pack, status: "active" }, blockers: [] }); });

describe("Catalog ordering panel", () => {
  it("prefills the exact pack and opens only the missing section", async () => {
    render(<OrderingSetupPanel variantId="pack-one" onClose={vi.fn()} onSaved={vi.fn().mockResolvedValue(undefined)} />);
    expect(await screen.findByText(/Gagan Excellent — 5 KG × 4/)).toBeInTheDocument();
    expect(screen.getByText("1 thing to check before ordering can be enabled.")).toBeInTheDocument();
    expect(screen.getByText("GST").closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Selling price").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Approved GST rate (%)")).toHaveValue(null);
    expect(mocks.orderingSetup).toHaveBeenCalledWith("pack-one");
  });

  it("saves an incomplete draft without enabling ordering", async () => {
    render(<OrderingSetupPanel variantId="pack-one" onClose={vi.fn()} onSaved={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.saveOrderingDraft).toHaveBeenCalledWith("pack-one", { revision: setup.revision, values: setup.values }));
    expect(mocks.enableOrdering).not.toHaveBeenCalled();
  });

  it("requires confirmation and keeps the selected pack identity", async () => {
    const onClose = vi.fn();
    render(<OrderingSetupPanel variantId="pack-one" onClose={onClose} onSaved={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save & enable ordering" }));
    expect(mocks.enableOrdering).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.enableOrdering).toHaveBeenCalledWith("pack-one", { revision: setup.revision, values: setup.values }));
    expect(onClose).toHaveBeenCalled();
  });

  it("opens missing identity in place and links stock to the supported inventory flow", async () => {
    mocks.orderingSetup.mockResolvedValueOnce({ ...setup, inventory: null, blockers: ["Approved catalogue identity is missing.", "Linked warehouse stock is unavailable. Use the authorised inventory import or refresh."] });
    render(<OrderingSetupPanel variantId="pack-one" onClose={vi.fn()} onSaved={vi.fn().mockResolvedValue(undefined)} />);
    expect(await screen.findByText(/This draft still needs an approved catalogue identity/)).toBeInTheDocument();
    expect(screen.getByText("Packing").closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Open inventory import" })).toHaveAttribute("href", "/imports?type=inventory");
  });
});
