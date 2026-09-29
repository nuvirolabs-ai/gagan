import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Catalog from "../Catalog";
import { ApiError } from "../../api";

const mocks = vi.hoisted(() => ({ products: vi.fn(), setPrice: vi.fn(), createProduct: vi.fn(), createAndPublishProduct: vi.fn(), saveCatalogueSku: vi.fn(), updateCatalogueSku: vi.fn(), updateProduct: vi.fn(), updateVariant: vi.fn(), addVariant: vi.fn(), publishCatalogue: vi.fn() }));
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

function fillCommercial(goldPrice = "3120") {
  fireEvent.change(screen.getByLabelText("Purchase price"), { target: { value: "3000" } });
  fireEvent.change(screen.getByLabelText("Base selling price"), { target: { value: "3300" } });
  fireEvent.change(screen.getByLabelText("Gold price"), { target: { value: goldPrice } });
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
      purchaseRate: 3000, listRate: 3300, gstPercent: 5, active: true,
      tiers: [{ tierId: "gold", price: 450 }],
      openingStockCases: 100, warehouseCode: "WH-001", routingClass: "LAXMI_TOOR",
    })));
    expect(mocks.createProduct).not.toHaveBeenCalled();
    expect(mocks.createAndPublishProduct).not.toHaveBeenCalled();
  });

  it("saves 1 kg × 30 and links tier discount to the entered price", async () => {
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
    fireEvent.change(screen.getByLabelText("Base selling price"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Gold price"), { target: { value: "450" } });
    expect(screen.getByLabelText("Gold discount %")).toHaveValue("10");
    fireEvent.change(screen.getByLabelText("Gold discount %"), { target: { value: "12" } });
    expect(screen.getByLabelText("Gold price")).toHaveValue("440");
    fireEvent.change(screen.getByLabelText("Purchase price"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("GST %"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Opening stock (cases)"), { target: { value: "30" } });
    expect(screen.getByText("30 cases · 900 units · 900 kg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveCatalogueSku).toHaveBeenCalledWith(expect.objectContaining({ tiers: [{ tierId: "gold", price: 440 }] })));
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

  it("reloads the stored list rate and derives each tier discount from it", async () => {
    mocks.updateCatalogueSku.mockResolvedValue({ productId: "ready", variantId: "ready-pack" });
    mocks.products.mockResolvedValue({ tiers: [{ id: "gold", name: "Gold" }, { id: "silver", name: "Silver" }], products: [{
      id: "ready", name: "Gagan Final Single Row Test", category: "Daal", catalogStatus: "active",
      catalogIdentityBrand: "GAGAN", catalogIdentityGroup: "TOOR DAL",
      variants: [{
        id: "ready-pack", catalogStatus: "active", catalogKey: "real-catalogue:variant:abc",
        unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1, catalogIdentityMasterPack: "30KG BAG",
        purchaseRate: 3000, purchaseRateBasis: "case", listRate: 3300, listRateBasis: "case", gstPercent: 5, routingClass: "LAXMI_TOOR",
        stock: { available: 100, status: "in_stock" },
        prices: [
          { tierId: "gold", tierName: "Gold", price: 3120, rateBasis: "case" },
          { tierId: "silver", tierName: "Silver", price: 3240, rateBasis: "case" },
        ],
      }],
    }] });
    render(<Catalog />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Base selling price")).toHaveValue("3300");
    expect(screen.getByLabelText("Selling price basis")).toHaveValue("case");
    expect(screen.getByLabelText("Gold price")).toHaveValue("3120");
    expect(screen.getByLabelText("Gold discount %")).toHaveValue("5.45");
    expect(screen.getByLabelText("Silver price")).toHaveValue("3240");
    expect(screen.getByLabelText("Silver discount %")).toHaveValue("1.82");
    fireEvent.change(screen.getByLabelText("Gold discount %"), { target: { value: "10" } });
    expect(screen.getByLabelText("Gold price")).toHaveValue("2970");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updateCatalogueSku).toHaveBeenCalledWith("ready-pack", expect.objectContaining({
      listRate: 3300,
      sellingRateBasis: "case",
      tiers: [{ tierId: "gold", price: 2970 }, { tierId: "silver", price: 3240 }],
    })));
    const saved = mocks.updateCatalogueSku.mock.calls[0][1] as { tiers: Array<Record<string, unknown>> };
    expect(saved.tiers.every((tier) => !("discountPercent" in tier))).toBe(true);
  });

  it("shows a complete row without a publish or ordering-setup step", async () => {
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
    expect(screen.getByText("Stock: 240 cases")).toBeInTheDocument();
    expect(screen.getByText("Purchase: ₹3,000/case")).toBeInTheDocument();
    expect(screen.getByText("Gold: ₹3,120/case")).toBeInTheDocument();
    expect(screen.getByText("Silver: ₹3,240/case")).toBeInTheDocument();
    expect(screen.getByText("GST: 5%")).toBeInTheDocument();
    expect(screen.getByText("Billing: Laxmi toor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish catalogue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up ordering" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ordering setup pending")).not.toBeInTheDocument();
  });

  it("does not surface archived rows when loading drafts", async () => {
    mocks.products.mockResolvedValue({ tiers: [], products: [{ id: "old", name: "Archived", catalogStatus: "archived", variants: [{ id: "old-v", unitSize: "1 kg", unitsPerCase: 1, unitWeightKg: 1, prices: [] }] }] });
    render(<Catalog />);
    await waitFor(() => expect(mocks.products).toHaveBeenCalledWith("all"));
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });
});
