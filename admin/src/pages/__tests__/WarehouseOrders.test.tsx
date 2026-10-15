import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

    // Clicking the order opens the pop-up modal
    fireEvent.click(await screen.findByRole("button", { name: /North Star Retail/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Toor Dal")).toBeInTheDocument();
    expect(within(dialog).getByText(/3 cases/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Mark packed/ })).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: /North Star Retail/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Mark packed/ }));

    await waitFor(() => expect(mocks.packWarehouseOrder).toHaveBeenCalledWith(order.id));
    expect(await screen.findByText("Packing complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Reject|Assign route|Capture delivery/ })).not.toBeInTheDocument();
  });

  it("filters the queue by supported warehouse states", async () => {
    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Packed" }));
    await waitFor(() => expect(mocks.warehouseOrders).toHaveBeenCalledWith("packed"));
  });

  it("opens and closes the fulfillment checklist pop-up modal", async () => {
    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /North Star Retail/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("North Star Retail")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps KPI metrics, pipeline totals, and pending queue counts stable when switching tabs", async () => {
    const confirmedOrder = {
      id: "order-1",
      status: "confirmed",
      createdAt: new Date().toISOString(),
      retailer: { id: "ret-1", name: "Alpha Store" },
      items: [{ id: "l-1", qtyOrdered: 2, variant: { unitSize: "1 kg", unit: "case", unitsPerCase: 10, product: { name: "Oil" } } }],
    };
    const deliveredOrder1 = {
      id: "order-2",
      status: "delivered",
      createdAt: new Date().toISOString(),
      retailer: { id: "ret-2", name: "Beta Store" },
      items: [{ id: "l-2", qtyOrdered: 1, variant: { unitSize: "1 kg", unit: "case", unitsPerCase: 10, product: { name: "Atta" } } }],
    };
    const deliveredOrder2 = {
      id: "order-3",
      status: "delivered",
      createdAt: new Date().toISOString(),
      retailer: { id: "ret-3", name: "Gamma Store" },
      items: [{ id: "l-3", qtyOrdered: 1, variant: { unitSize: "1 kg", unit: "case", unitsPerCase: 10, product: { name: "Dal" } } }],
    };

    const allPipeline = [confirmedOrder, deliveredOrder1, deliveredOrder2];

    mocks.warehouseOrders.mockImplementation(async (status?: string) => {
      if (status === "all") return { orders: allPipeline };
      if (status === "confirmed") return { orders: [confirmedOrder] };
      if (status === "packed") return { orders: [] };
      if (status === "delivered") return { orders: [deliveredOrder1, deliveredOrder2] };
      return { orders: [confirmedOrder] };
    });

    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);

    // On initial render ("all"):
    expect(await screen.findByText("Alpha Store")).toBeInTheDocument();
    const queueBadge = document.querySelector(".warehouse-queue-count strong");
    expect(queueBadge?.textContent).toBe("1");
    expect(document.querySelector(".kpi-total .warehouse-kpi-value")?.textContent).toBe("3");
    expect(document.querySelector(".kpi-confirmed .warehouse-kpi-value")?.textContent).toBe("1");
    expect(document.querySelector(".kpi-packed .warehouse-kpi-value")?.textContent).toBe("0");
    expect(document.querySelector(".kpi-delivered .warehouse-kpi-value")?.textContent).toBe("2");

    // Click "Packed" tab
    fireEvent.click(screen.getByRole("button", { name: "Packed" }));
    await waitFor(() => {
      expect(queueBadge?.textContent).toBe("1");
    });
    // Total pipeline and delivered remain unchanged!
    expect(document.querySelector(".kpi-total .warehouse-kpi-value")?.textContent).toBe("3");
    expect(document.querySelector(".kpi-delivered .warehouse-kpi-value")?.textContent).toBe("2");
    expect(document.querySelector(".kpi-confirmed .warehouse-kpi-value")?.textContent).toBe("1");
    expect(document.querySelector(".kpi-packed .warehouse-kpi-value")?.textContent).toBe("0");

    // Click "Delivered" tab
    fireEvent.click(screen.getByRole("button", { name: "Delivered" }));
    await waitFor(() => {
      expect(document.querySelector(".kpi-total .warehouse-kpi-value")?.textContent).toBe("3");
    });
    expect(queueBadge?.textContent).toBe("1");
    expect(document.querySelector(".kpi-delivered .warehouse-kpi-value")?.textContent).toBe("2");

    // Click back to "All" tab
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(document.querySelector(".kpi-total .warehouse-kpi-value")?.textContent).toBe("3");
    });
    expect(queueBadge?.textContent).toBe("1");
    expect(document.querySelector(".kpi-delivered .warehouse-kpi-value")?.textContent).toBe("2");
  });
});
