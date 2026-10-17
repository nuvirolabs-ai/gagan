import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Catalog from "../Catalog";
import { ApiError } from "../../api";

const mocks = vi.hoisted(() => ({ products: vi.fn(), setPrice: vi.fn(), createProduct: vi.fn(), createAndPublishProduct: vi.fn(), saveCatalogueSku: vi.fn(), updateCatalogueSku: vi.fn(), updateProduct: vi.fn(), updateVariant: vi.fn(), addVariant: vi.fn(), publishCatalogue: vi.fn(), quickEditVariant: vi.fn(), quickEditProduct: vi.fn() }));
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

function fillCommercial(price = "3120") {
  fireEvent.change(screen.getByLabelText("Selling price"), { target: { value: price } });
  fireEvent.change(screen.getByLabelText("GST %"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Opening stock (cases)"), { target: { value: "100" } });
}

describe("Catalog commercial rate display", () => {
  it("searches loaded SKUs by product, category, pack and code without refetching", async () => {
    mocks.products.mockResolvedValue({ tiers: [], products: [
      { id: "a", name: "Classic Toor", category: "Daal", internalCode: "GAGAN-PRODUCT", variants: [{ id: "a1", unitSize: "30 kg", unitsPerCase: 1, unitWeightKg: 30, internalCode: "GAGAN-INT-30", catalogIdentitySkuName: "Classic large case", prices: [] }] },
      { id: "b", name: "Basmati Rice", category: "Rice", variants: [{ id: "b1", unitSize: "1 kg", unitsPerCase: 12, unitWeightKg: 1, catalogKey: "RICE-12", prices: [] }] },
    ] });
    render(<Catalog />);
    expect(await screen.findByText("2 of 2 SKUs")).toBeInTheDocument();
    for (const term of ["classic", "daal", "30 kg", "GAGAN-INT", "int-30", "gagan-product", "large case"]) {
      fireEvent.change(screen.getByRole("searchbox", { name: "Search catalogue" }), { target: { value: term } });
      expect(screen.getByText("1 of 2 SKUs")).toBeInTheDocument();
      expect(screen.getByText("Classic Toor")).toBeInTheDocument();
      expect(screen.queryByText("Basmati Rice")).not.toBeInTheDocument();
    }
    fireEvent.change(screen.getByRole("searchbox", { name: "Search catalogue" }), { target: { value: "xyz" } });
    expect(screen.getByText("No products match ‘xyz’")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("2 of 2 SKUs")).toBeInTheDocument();
    expect(mocks.products).toHaveBeenCalledTimes(1);
  });
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

  it("saves one sellable row from the product form", async () => {
    mocks.saveCatalogueSku.mockResolvedValue({ productId: "new", variantId: "pack" });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Sample dal" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Daal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "g" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "12" } });
    expect(screen.getByText("500 g equals 0.5 kg per unit.")).toBeInTheDocument();
    expect(screen.getByText("Weight per unit: 0.5 kg")).toBeInTheDocument();
    fillCommercial("450");
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish catalogue" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveCatalogueSku).toHaveBeenCalledWith(expect.objectContaining({
      productName: "Sample dal", brandName: "Gagan", groupName: "Gagan Daal", category: "Daal",
      packSize: "500", unit: "g", unitsPerCase: 12, outerPack: "Bag",
      purchaseRate: 450, listRate: 450, gstPercent: 5, active: true,
      tiers: [{ tierId: "gold", price: 450 }],
      openingStockCases: 100, warehouseCode: "WH-001", routingClass: "LAXMI_TOOR",
    })));
    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.createAndPublishProduct).not.toHaveBeenCalled();
  });

  it("saves 1 kg × 30 with single pricing across all tiers", async () => {
    mocks.saveCatalogueSku.mockResolvedValue({ productId: "daal", variantId: "pack" });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Testing Daal" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Daal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "30" } });
    expect(screen.getByText("For a 1 kg pack, weight per unit is 1 kg.")).toBeInTheDocument();
    expect(screen.getByText("Case weight: 30 kg")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Selling price"), { target: { value: "440" } });
    expect(screen.getByText("₹14.67 / kg")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Purchase price"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("GST %"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Opening stock (cases)"), { target: { value: "30" } });
    expect(screen.getByText("30 cases · 900 units · 900 kg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveCatalogueSku).toHaveBeenCalledWith(expect.objectContaining({
      listRate: 440,
      tiers: [{ tierId: "gold", price: 440 }],
    })));
    expect(await screen.findByText("Product saved.")).toBeInTheDocument();
    expect(screen.queryByText("Catalogue published. Ordering setup is still separate.")).not.toBeInTheDocument();
  });

  it("saves a complete product without asking for semantic identity", async () => {
    mocks.saveCatalogueSku.mockResolvedValue({ productId: "published-product", variantId: "published-pack" });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Gagan Toor Dal" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Toor Dal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Outer pack"), { target: { value: "Bag" } });
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "https://example.test/toor.png" } });

    expect(screen.queryByLabelText("Product label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SKU name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Master pack")).not.toBeInTheDocument();
    fillCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveCatalogueSku).toHaveBeenCalledWith(expect.objectContaining({
      productName: "Gagan Toor Dal", imageUrl: "https://example.test/toor.png", packSize: "1", unit: "kg", unitsPerCase: 30, outerPack: "Bag",
    })));
    expect(mocks.createAndPublishProduct).not.toHaveBeenCalled();
    expect(await screen.findByText("Product saved.")).toBeInTheDocument();
  });

  it("blocks an empty pack size before calling the API", async () => {
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Testing Daal" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Daal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a pack size greater than zero.");
    expect(mocks.saveCatalogueSku).not.toHaveBeenCalled();
  });

  it("asks for measured weight only for piece packs", async () => {
    mocks.saveCatalogueSku.mockResolvedValue({ productId: "pieces", variantId: "pack" });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Sample pieces" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Pack" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Pack" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "pcs" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the measured weight per piece in kg.");
    expect(mocks.saveCatalogueSku).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Measured weight per piece (kg)"), { target: { value: "0.25" } });
    fillCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveCatalogueSku).toHaveBeenCalledWith(expect.objectContaining({ packSize: "6", unit: "pcs", unitsPerCase: 12, measuredWeightKg: 0.25 })));
  });

  it("translates a raw invalid_pack response into a field message", async () => {
    mocks.saveCatalogueSku.mockRejectedValue(new ApiError(400, { error: "invalid_pack", details: [{ index: 0, error: "unitsPerCase must be a positive whole number." }] }));
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Testing Daal" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Daal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "30" } });
    fillCommercial();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Units per case must be a whole number.");
    expect(screen.queryByText("invalid_pack")).not.toBeInTheDocument();
  });

  it("shows a field-specific message for an invalid image URL", async () => {
    mocks.createAndPublishProduct.mockRejectedValue(new ApiError(400, { error: "Invalid input", details: { fieldErrors: { "product.imageUrl": ["Invalid url"] } } }));
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    fireEvent.change(screen.getByLabelText("Product name"), { target: { value: "Testing Daal" } });
    fireEvent.change(screen.getByLabelText("Product group"), { target: { value: "Gagan Daal" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Daal" } });
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Image URL"), { target: { value: "bad-url" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid Image URL or leave it blank.");
    expect(screen.queryByText("Enter a pack size greater than zero.")).not.toBeInTheDocument();
  });

  it("offers metadata and pack editing only on pending-review rows", async () => {
    mocks.products.mockResolvedValue({ tiers: [], products: [{ id: "draft", name: "Sample", category: "Food", catalogStatus: "pending_review", variants: [{ id: "v", catalogStatus: "pending_review", unitSize: "1 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }, { id: "live", name: "Live", category: "Food", catalogStatus: "active", variants: [{ id: "active-v", catalogStatus: "active", unitSize: "1 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }] });
    render(<Catalog />);
    expect(await screen.findAllByRole("button", { name: "Edit draft" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Publish catalogue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete setup" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add pack" })).toHaveLength(2);
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

  it("edits price, sku, gst and billing rule in the same row and saves changes", async () => {
    mocks.quickEditVariant.mockResolvedValue({ ok: true });
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{
      id: "ready", name: "Gagan Final Single Row Test", category: "Daal", catalogStatus: "active",
      variants: [{
        id: "ready-pack", catalogStatus: "active",
        unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1,
        purchaseRate: 3000, purchaseRateBasis: "case", listRate: 3300, listRateBasis: "case", gstPercent: 5, routingClass: "LAXMI_TOOR",
        prices: [{ tierId: "gold", tierName: "Gold", price: 3120, rateBasis: "case" }],
      }],
    }] });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Pack size")).toHaveValue(1);
    expect(screen.getByLabelText("Units per case")).toHaveValue(30);
    expect(screen.getByLabelText("GST %")).toHaveValue("5");
    expect(screen.getByLabelText("Billing rule")).toHaveValue("LAXMI_TOOR");
    expect(screen.getByLabelText("Selling price")).toHaveValue(3120);
    fireEvent.change(screen.getByLabelText("Selling price"), { target: { value: "3400" } });
    fireEvent.change(screen.getByLabelText("GST %"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.quickEditVariant).toHaveBeenCalledWith("ready-pack", expect.objectContaining({
      price: 3400,
      gstPercent: 12,
      routingClass: "LAXMI_TOOR",
      packSize: "1",
      unit: "kg",
      unitsPerCase: 30,
      rateBasis: "case",
    })));
  });

  it("shows a complete row with single pricing without ordering-setup or multiple tier columns", async () => {
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }, { id: "silver", name: "Silver" }], products: [{
      id: "ready", name: "Gagan Toor Dal", category: "Daal", catalogStatus: "active",
      variants: [{
        id: "ready-pack", catalogStatus: "active", catalogKey: "real-catalogue:variant:abc", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1,
        purchaseRate: 3000, purchaseRateBasis: "case", gstPercent: 5, routingClass: "LAXMI_TOOR",
        stock: { available: 240, status: "in_stock" },
        prices: [{ tierId: "gold", tierName: "Gold", price: 3120, rateBasis: "case" }, { tierId: "silver", tierName: "Silver", price: 3240, rateBasis: "case" }],
      }],
    }] });
    render(<Catalog />);
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.getByText("1 kg × 30")).toBeInTheDocument();
    expect(screen.getByText("30 kg case")).toBeInTheDocument();
    expect(screen.getByText("GST: 5%")).toBeInTheDocument();
    expect(screen.getByText("Billing: Laxmi toor")).toBeInTheDocument();
    expect(screen.getByText("₹3,120 / case")).toBeInTheDocument();
    expect(screen.getByText("₹104 / kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish catalogue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up ordering" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage setup" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ordering setup pending")).not.toBeInTheDocument();
    expect(screen.queryByText("Gold: ₹3,120/case")).not.toBeInTheDocument();
    expect(screen.queryByText("Silver: ₹3,240/case")).not.toBeInTheDocument();
  });

  it("automatically updates price of case simultaneously when pack size or units per case is edited", async () => {
    mocks.quickEditVariant.mockResolvedValue({ ok: true });
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{
      id: "toor", name: "Gagan Toor Dal", category: "Daal", catalogStatus: "active",
      variants: [{
        id: "toor-5-6", catalogStatus: "active",
        unitSize: "5 kg", unit: "kg", unitsPerCase: 6, unitWeightKg: 5,
        purchaseRate: 2800, listRate: 3150, listRateBasis: "case", gstPercent: 5, routingClass: "LAXMI_TOOR",
        prices: [{ tierId: "gold", tierName: "Gold", price: 3150, rateBasis: "case" }],
      }],
    }] });
    render(<Catalog />);
    // User clicks the pack size directly or clicks Edit
    fireEvent.click(await screen.findByRole("button", { name: /5 kg × 6/ }));
    expect(screen.getByLabelText("Pack size")).toHaveValue(5);
    expect(screen.getByLabelText("Units per case")).toHaveValue(6);
    expect(screen.getByLabelText("Selling price")).toHaveValue(3150);
    expect(screen.getByLabelText("Rate per kg")).toHaveValue("105");

    // User updates units per case from 6 to 5 (25 kg case)
    // 25 kg * 105 / kg = 2625
    fireEvent.change(screen.getByLabelText("Units per case"), { target: { value: "5" } });
    expect(screen.getByLabelText("Selling price")).toHaveValue(2625);
    expect(screen.getByText("Case: ~25 kg")).toBeInTheDocument();

    // User updates pack size from 5 to 10 (10 kg * 5 = 50 kg case)
    // 50 kg * 105 / kg = 5250
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "10" } });
    expect(screen.getByLabelText("Selling price")).toHaveValue(5250);
    expect(screen.getByText("Case: ~50 kg")).toBeInTheDocument();

    // User clicks save
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.quickEditVariant).toHaveBeenCalledWith("toor-5-6", expect.objectContaining({
      packSize: "10",
      unit: "kg",
      unitsPerCase: 5,
      price: 5250,
      rateBasis: "case",
    })));
  });

  it("updates pricing in quintal, per kg, and per quintal rate basis, persisting correctly without reverting to older price", async () => {
    mocks.quickEditVariant.mockResolvedValue({ ok: true });
    mocks.products.mockResolvedValueOnce({ tiers: [{ id: "gold", name: "Gold" }], products: [{
      id: "prod-dal", name: "Laxmi Toor Dal", category: "Daal", catalogStatus: "active",
      variants: [{
        id: "var-dal-30", catalogStatus: "active",
        unitSize: "30 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 30,
        purchaseRate: 5000, listRate: 5400, listRateBasis: "case", gstPercent: 0, routingClass: "OTHER",
        prices: [{ tierId: "gold", tierName: "Gold", price: 5400, rateBasis: "case" }],
      }],
    }] });

    render(<Catalog />);
    expect(await screen.findByText("₹5,400 / case")).toBeInTheDocument();
    expect(screen.getByText("₹180 / kg")).toBeInTheDocument();

    // Click Edit to enter quick-edit
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Selling price")).toHaveValue(5400);
    expect(screen.getByLabelText("Rate per kg")).toHaveValue("180");
    expect(screen.getByLabelText("Rate basis")).toHaveValue("case");

    // Change rate basis to quintal: price becomes 180 * 100 = 18000
    fireEvent.change(screen.getByLabelText("Rate basis"), { target: { value: "quintal" } });
    expect(screen.getByLabelText("Selling price")).toHaveValue(18000);
    expect(screen.getByText("INR / quintal")).toBeInTheDocument();

    // Change kg rate to 185: quintal price becomes 18500
    fireEvent.change(screen.getByLabelText("Rate per kg"), { target: { value: "185" } });
    expect(screen.getByLabelText("Selling price")).toHaveValue(18500);

    // Mock products return for the reload after save
    mocks.products.mockResolvedValueOnce({ tiers: [{ id: "gold", name: "Gold" }], products: [{
      id: "prod-dal", name: "Laxmi Toor Dal", category: "Daal", catalogStatus: "active",
      variants: [{
        id: "var-dal-30", catalogStatus: "active",
        unitSize: "30 kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 30,
        purchaseRate: 5000, listRate: 18500, listRateBasis: "quintal", gstPercent: 0, routingClass: "OTHER",
        prices: [{ tierId: "gold", tierName: "Gold", price: 18500, rateBasis: "quintal" }],
      }],
    }] });

    // Click save
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.quickEditVariant).toHaveBeenCalledWith("var-dal-30", expect.objectContaining({
      price: 18500,
      rateBasis: "quintal",
      packSize: "30",
      unit: "kg",
      unitsPerCase: 1,
    })));

    // Confirm that the updated price in quintal is rendered
    expect(await screen.findByText("₹18,500 / quintal")).toBeInTheDocument();
    expect(screen.getByText("₹185 / kg")).toBeInTheDocument();
    expect(screen.getByText("₹5,550 / 30 KG case")).toBeInTheDocument();
    expect(screen.queryByText("₹5,400 / case")).not.toBeInTheDocument();
  });

  it("allows editing product name, category, and image URL for an already listed product via Edit product modal", async () => {
    mocks.quickEditProduct.mockResolvedValue({ ok: true });
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{
      id: "toor-prod", name: "Gagan Toor Dal", category: "Daal", catalogStatus: "active", imageUrl: "http://example.com/toor.jpg",
      variants: [{
        id: "toor-1", catalogStatus: "active", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1,
        prices: [{ tierId: "gold", price: 3120, rateBasis: "case" }],
      }],
    }] });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "✎ Edit product" }));
    expect(screen.getByLabelText("Edit product name")).toHaveValue("Gagan Toor Dal");
    expect(screen.getByLabelText("Edit category")).toHaveValue("Daal");
    expect(screen.getByLabelText("Edit image URL")).toHaveValue("http://example.com/toor.jpg");

    fireEvent.change(screen.getByLabelText("Edit product name"), { target: { value: "Gagan Premium Toor Dal" } });
    fireEvent.change(screen.getByLabelText("Edit category"), { target: { value: "Pulses & Grains" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Product" }));

    await waitFor(() => expect(mocks.quickEditProduct).toHaveBeenCalledWith("toor-prod", {
      name: "Gagan Premium Toor Dal",
      category: "Pulses & Grains",
      imageUrl: "http://example.com/toor.jpg",
    }));
  });

  it("allows editing product name and category in CatalogueSkuForm when adding a pack to an existing product", async () => {
    mocks.saveCatalogueSku.mockResolvedValue({ productId: "toor-prod", variantId: "new-pack" });
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }], products: [{
      id: "toor-prod", name: "Gagan Toor Dal", category: "Daal", catalogStatus: "active",
      variants: [{
        id: "toor-1", catalogStatus: "active", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1,
        prices: [{ tierId: "gold", price: 3120, rateBasis: "case" }],
      }],
    }] });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Add pack" }));
    const nameInput = screen.getByLabelText("Product name");
    const categoryInput = screen.getByLabelText("Category");
    expect(nameInput).not.toHaveAttribute("readonly");
    expect(categoryInput).not.toHaveAttribute("readonly");

    fireEvent.change(nameInput, { target: { value: "Gagan Daily Toor Dal" } });
    fireEvent.change(categoryInput, { target: { value: "Pulses" } });
    fireEvent.change(screen.getByLabelText("Selling price"), { target: { value: "3200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.saveCatalogueSku).toHaveBeenCalledWith(expect.objectContaining({
      productId: "toor-prod",
      productName: "Gagan Daily Toor Dal",
      category: "Pulses",
      listRate: 3200,
    })));
  });

  it("does not surface archived rows when loading drafts", async () => {
    mocks.products.mockResolvedValue({ tiers: [], products: [{ id: "old", name: "Archived", catalogStatus: "archived", variants: [{ id: "old-v", unitSize: "1 kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }] });
    render(<Catalog />);
    await waitFor(() => expect(mocks.products).toHaveBeenCalledWith("all"));
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });
});
