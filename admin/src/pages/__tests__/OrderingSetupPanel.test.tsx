import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

function renderPanel(onClose = vi.fn()) {
  return render(<MemoryRouter><OrderingSetupPanel variantId="pack-one" onClose={onClose} onSaved={vi.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
}

describe("Catalog ordering panel", () => {
  it("prefills the exact pack and opens only the missing section", async () => {
    renderPanel();
    expect(await screen.findByText(/Gagan Excellent — 5 KG × 4/)).toBeInTheDocument();
    expect(screen.getByText("1 thing to check before ordering can be enabled.")).toBeInTheDocument();
    expect(screen.getByText("GST").closest("details")).toHaveAttribute("open");
    expect(screen.getByText("Selling price").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Approved GST rate (%)")).toHaveValue(null);
    expect(mocks.orderingSetup).toHaveBeenCalledWith("pack-one");
  });

  it("does not duplicate the pack unit in the setup heading", async () => {
    mocks.orderingSetup.mockResolvedValueOnce({ ...setup, pack: { ...setup.pack, label: "1 kg × 30", unitWeightKg: 1, unitsPerCase: 30, caseWeightKg: 30 } });
    renderPanel();
    expect(await screen.findByText(/Gagan Excellent — 1 kg × 30/)).toBeInTheDocument();
    expect(screen.queryByText(/1 kg kg/)).not.toBeInTheDocument();
  });

  it("saves an incomplete draft without enabling ordering", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.saveOrderingDraft).toHaveBeenCalledWith("pack-one", { revision: setup.revision, values: setup.values }));
    expect(mocks.enableOrdering).not.toHaveBeenCalled();
  });

  it("requires confirmation and keeps the selected pack identity", async () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    fireEvent.click(await screen.findByRole("button", { name: "Save & enable ordering" }));
    expect(mocks.enableOrdering).not.toHaveBeenCalled();
    expect(screen.getByText(/GST not configured/)).toBeInTheDocument();
    expect(screen.queryByText(/Approved GST-pending exception/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.enableOrdering).toHaveBeenCalledWith("pack-one", { revision: setup.revision, values: setup.values }));
    expect(onClose).toHaveBeenCalled();
  });

  it("explains missing catalogue identity without a navigation action and links stock to inventory import", async () => {
    mocks.orderingSetup.mockResolvedValueOnce({ ...setup, inventory: null, blockers: ["Approved catalogue identity is missing.", "Linked warehouse stock is unavailable. Use the authorised inventory import or refresh."] });
    renderPanel();
    expect(await screen.findByText("Approved catalogue identity is missing.")).toBeInTheDocument();
    expect(screen.getAllByText("Not available in Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requires controlled catalogue publication workflow").length).toBeGreaterThan(0);
    expect(screen.getByText("Packing").closest("details")).toHaveAttribute("open");
    for (const status of screen.getAllByText("Not available in Admin")) {
      expect(status.closest("a")).toBeNull();
      expect(status.closest("button")).toBeNull();
    }
    expect(screen.queryByRole("link", { name: /catalogue identity|catalog|data import/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /catalogue identity|Not available in Admin|permission/i })).toBeNull();
    const imports = screen.getAllByRole("link", { name: "Open inventory import" });
    expect(imports.length).toBeGreaterThan(0);
    for (const link of imports) expect(link).toHaveAttribute("href", "/imports?type=inventory");
  });

  it("focuses the GST control from the GST blocker", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Set GST rate" }));
    await waitFor(() => expect(screen.getByLabelText("Approved GST rate (%)")).toHaveFocus());
  });

  it("focuses the selling price section from the price blocker", async () => {
    mocks.orderingSetup.mockResolvedValueOnce({
      ...setup,
      values: { ...setup.values, gstPercent: "5", sellingEntity: "jain_traders", routingClass: null, prices: [{ tierId: "gold", rate: "", rateBasis: "case" }] },
      blockers: ["Set a positive rate for each applicable price tier."],
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Set selling price" }));
    await waitFor(() => expect(screen.getByText("Selling price").closest("summary")).toHaveFocus());
    expect(screen.getByText("Selling price").closest("details")).toHaveAttribute("open");
  });

  it("focuses the billing section from the billing blocker", async () => {
    mocks.orderingSetup.mockResolvedValueOnce({
      ...setup,
      values: { ...setup.values, gstPercent: "5", sellingEntity: null, routingClass: null, prices: [{ tierId: "gold", rate: "10", rateBasis: "case" }] },
      blockers: ["Select the approved billing rule."],
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Set billing rule" }));
    await waitFor(() => expect(screen.getByText("Billing rule").closest("summary")).toHaveFocus());
    expect(screen.getByText("Billing rule").closest("details")).toHaveAttribute("open");
  });

  it("leaves an unknown blocker as readable status text", async () => {
    mocks.orderingSetup.mockResolvedValueOnce({
      ...setup,
      values: { ...setup.values, gstPercent: "5", sellingEntity: "jain_traders", routingClass: null, prices: [{ tierId: "gold", rate: "10", rateBasis: "case" }] },
      blockers: ["A future catalogue rule changed outside Admin."],
    });
    renderPanel();
    const status = await screen.findByText("A future catalogue rule changed outside Admin.");
    expect(status.closest("button")).toBeNull();
    expect(status.closest("a")).toBeNull();
    expect(screen.queryByRole("button", { name: "A future catalogue rule changed outside Admin." })).toBeNull();
  });

  it("closes on Escape only when search is not open", async () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    expect(await screen.findByText(/Gagan Excellent — 5 KG × 4/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
