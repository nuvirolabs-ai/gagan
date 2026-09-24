import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Orders from "../Orders";
import {
  orderCreatedAtLabel,
  orderSourceLabel,
  proposalIntentSourceLabel,
} from "../../orderAttribution";

const mocks = vi.hoisted(() => ({
  orders: vi.fn(),
  commercialStatuses: vi.fn(),
}));
vi.mock("../../api", () => ({
  api: mocks,
  inr: (value: number) => `₹${Number(value).toFixed(2)}`,
}));

const order = {
  id: "order-source",
  orderNo: 81,
  status: "placed",
  source: "SALESPERSON_APP",
  placedBy: "rep",
  creatorName: "Asha Verma",
  retailer: { id: "retailer-source", name: "North Star Retail", phone: "9876543210" },
  createdAt: "2026-09-25T10:15:00.000Z",
  orderTotal: "1200",
  items: [],
  delivery: null,
  sapSyncStatus: "pending",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.orders.mockImplementation(async (status: string) => ({ orders: status === "placed" ? [order] : [] }));
  mocks.commercialStatuses.mockResolvedValue({ orders: [] });
});

describe("Admin order attribution", () => {
  it("labels order source and creator, falling back for missing creator names", () => {
    expect(orderSourceLabel(order)).toBe("Order punched by Asha Verma");
    expect(orderSourceLabel({ source: "RETAILER_APP" })).toBe("Order placed via Retailer App");
    expect(orderSourceLabel({ source: "SALESPERSON_APP" })).toBe("Order punched by Salesperson");
  });

  it("labels punched proposal demand and preserves its punch timestamp", () => {
    expect(proposalIntentSourceLabel({ source: "SALESPERSON_APP", creatorName: "Asha Verma" }))
      .toBe("Order punched by Asha Verma");
    expect(orderCreatedAtLabel(order)).not.toBe("Time unavailable");
    expect(orderCreatedAtLabel({})).toBe("Time unavailable");
  });

  it("renders attribution, timestamp and retailer in the selected order workspace", async () => {
    render(<MemoryRouter><Orders /></MemoryRouter>);
    expect(await screen.findByText(/Order punched by Asha Verma/)).toBeTruthy();
    expect(screen.getAllByText("North Star Retail").length).toBeGreaterThan(0);
    expect(mocks.orders).toHaveBeenCalledWith("placed");
  });
});
