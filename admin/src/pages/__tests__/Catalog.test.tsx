import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Catalog from "../Catalog";

const mocks = vi.hoisted(() => ({ products: vi.fn(), setPrice: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(), updateVariant: vi.fn(), addVariant: vi.fn() }));
vi.mock("../../api", async (original) => ({ ...await original<typeof import("../../api")>(), api: mocks }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{
    id: "broken", name: "Gagan Broken", category: "Rice", variants: [{
      id: "broken-30", unitSize: "30 KG", unitsPerCase: 1, unitWeightKg: 30,
      prices: [{ tierId: "gold", price: 5400, rateBasis: "quintal" }],
    }],
  }] });
});

describe("Catalog commercial rate display", () => {
  it("labels the unchanged quintal rate and derives kg and case equivalents", async () => {
    render(<Catalog />);
    expect(await screen.findByText("₹5,400 / quintal")).toBeInTheDocument();
    expect(screen.getByText("₹54 / kg")).toBeInTheDocument();
    expect(screen.getByText("₹1,620 / 30 KG case")).toBeInTheDocument();
    expect(screen.queryByText(/₹5,400 \/ case/)).not.toBeInTheDocument();
    expect(mocks.setPrice).not.toHaveBeenCalled();
  });

  it("edits the authoritative rate rather than its derived case equivalent", async () => {
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: /₹5,400/ }));
    expect(screen.getByRole("spinbutton")).toHaveValue(5400);
    expect(screen.getByText("INR / quintal")).toBeInTheDocument();
    expect(mocks.setPrice).not.toHaveBeenCalled();
  });

  it("retains fractional kilogram rates instead of rounding them to whole rupees", async () => {
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{ name: "Classic", variants: [{
      id: "classic", unitSize: "1 KG", unitsPerCase: 20, unitWeightKg: 1,
      prices: [{ tierId: "gold", price: 9950, rateBasis: "quintal" }],
    }] }] });
    render(<Catalog />);
    expect(await screen.findByText("₹99.5 / kg")).toBeInTheDocument();
    expect(screen.getByText("₹1,990 / 20 KG case")).toBeInTheDocument();
  });

  it("creates a pending-review product with an explicit mass pack", async () => {
    mocks.createProduct.mockResolvedValue({ product: { id: "new" } });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Create draft" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Sample dal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "500 g" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "g" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Weight per unit (kg)"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith({ name: "Sample dal", category: "Daal", variants: [{ unitSize: "500 g", unit: "g", unitsPerCase: 12, unitWeightKg: 0.5 }] }));
    expect(mocks.products).toHaveBeenCalledWith("all");
  });

  it("offers metadata and pack editing only on pending-review rows", async () => {
    mocks.products.mockResolvedValue({ tiers: [], products: [{ id: "draft", name: "Sample", category: "Food", catalogStatus: "pending_review", variants: [{ id: "v", catalogStatus: "pending_review", unitSize: "1 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }, { id: "live", name: "Live", category: "Food", catalogStatus: "active", variants: [{ id: "active-v", catalogStatus: "active", unitSize: "1 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }] });
    render(<Catalog />);
    expect(await screen.findAllByRole("button", { name: "Edit draft" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
    expect(screen.getByRole("button", { name: "Save pack" })).toBeInTheDocument();
  });

  it("shows import IDs and edits a pending pack beneath an active product", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mocks.products.mockResolvedValue({ tiers: [], products: [{ id: "live-product", name: "Live", category: "Food", catalogStatus: "active", variants: [{ id: "pending-pack", catalogStatus: "pending_review", unitSize: "500 g", unit: "g", unitsPerCase: 20, unitWeightKg: 0.5, prices: [] }] }] });
    mocks.updateVariant.mockResolvedValue({ variant: { id: "pending-pack" } });
    render(<Catalog />);
    expect(await screen.findByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/live-product/)).toBeInTheDocument();
    expect(screen.getByText(/pending-pack/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy variant ID" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("pending-pack"));
    fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Save pack" }));
    await waitFor(() => expect(mocks.updateVariant).toHaveBeenCalledWith("pending-pack", { unitSize: "500 g", unit: "g", unitsPerCase: 20, unitWeightKg: 0.5 }));
  });

  it("does not invite a basis-free tier price on a draft", async () => {
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{ id: "draft", name: "Sample", category: "Food", catalogStatus: "pending_review", variants: [{ id: "v", catalogStatus: "pending_review", unitSize: "1 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 1, prices: [{ tierId: "gold", price: null, rateBasis: "case" }] }] }] });
    render(<Catalog />);
    expect(await screen.findByText("Sample")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set price" })).not.toBeInTheDocument();
  });

  it("does not surface archived rows when loading drafts", async () => {
    mocks.products.mockResolvedValue({ tiers: [], products: [{ id: "old", name: "Archived", catalogStatus: "archived", variants: [{ id: "old-v", unitSize: "1 kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }] });
    render(<Catalog />);
    await waitFor(() => expect(mocks.products).toHaveBeenCalledWith("all"));
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });
});
