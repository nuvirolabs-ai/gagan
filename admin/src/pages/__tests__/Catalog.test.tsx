import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Catalog from "../Catalog";

const mocks = vi.hoisted(() => ({ products: vi.fn(), setPrice: vi.fn() }));
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
});
