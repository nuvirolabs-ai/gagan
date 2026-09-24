import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Orders from "../Orders";

const mocks = vi.hoisted(() => ({
  orders: vi.fn(),
  commercialStatuses: vi.fn(),
  warehouseOrders: vi.fn(),
  warehouseOrder: vi.fn(),
  packWarehouseOrder: vi.fn(),
}));
vi.mock("../../api", () => ({ api: mocks, inr: (value: number) => `₹${value}` }));

const order = {
  id: "warehouse-order-1",
  status: "confirmed",
  createdAt: "2026-09-25T10:15:00.000Z",
  retailer: { id: "retailer-1", name: "North Star Retail" },
  items: [{
    id: "line-1",
    qtyOrdered: 3,
    variant: {
      unitSize: "1 kg",
      unit: "case",
      unitsPerCase: 12,
      product: { name: "Toor Dal" },
    },
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.orders.mockResolvedValue({ orders: [] });
  mocks.commercialStatuses.mockResolvedValue({ orders: [] });
  mocks.warehouseOrders.mockResolvedValue({ orders: [order] });
  mocks.warehouseOrder.mockResolvedValue({ order });
  mocks.packWarehouseOrder.mockResolvedValue({ order: { ...order, status: "packed" } });
});

describe("warehouse order processing", () => {
  it("shows only eligible order work and its line items without commercial amounts", async () => {
    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Warehouse orders" })).toBeInTheDocument();
    expect((await screen.findAllByText("North Star Retail")).length).toBeGreaterThan(0);
    expect(screen.getByText("Toor Dal")).toBeInTheDocument();
    expect(screen.getByText(/3 cases/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark packed/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Reject|Assign route|Capture delivery|Put on hold/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/₹|unit price|order value/i)).not.toBeInTheDocument();
    expect(mocks.warehouseOrders).toHaveBeenCalledWith(undefined);
  });

  it("uses the existing pack action and refreshes the shared order state", async () => {
    mocks.packWarehouseOrder.mockImplementation(async () => {
      const packed = { ...order, status: "packed" };
      mocks.warehouseOrders.mockResolvedValue({ orders: [packed] });
      mocks.warehouseOrder.mockResolvedValue({ order: packed });
      return { order: packed };
    });
    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: /Mark packed/ }));

    await waitFor(() => expect(mocks.packWarehouseOrder).toHaveBeenCalledWith(order.id));
    expect(await screen.findByText("Packing complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Reject|Assign route|Capture delivery/ })).not.toBeInTheDocument();
  });

  it("filters the queue by supported warehouse states", async () => {
    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Packed" }));
    await waitFor(() => expect(mocks.warehouseOrders).toHaveBeenCalledWith("packed"));
  });
});
