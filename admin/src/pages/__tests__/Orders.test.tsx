import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../../App";
import Orders from "../Orders";

const auth = vi.hoisted(() => ({ permissions: ["staff.manage"] as string[] }));
const mocks = vi.hoisted(() => ({
  orders: vi.fn(),
  commercialStatuses: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  pack: vi.fn(),
  holdOrder: vi.fn(),
  releaseOrderHold: vi.fn(),
  warehouseOrders: vi.fn(),
  warehouseOrder: vi.fn(),
  packWarehouseOrder: vi.fn(),
  approvals: vi.fn(async () => ({ requests: [] })),
  collections: vi.fn(async () => ({ submissions: [] })),
  retailerProposals: vi.fn(async () => ({ proposals: [] })),
  fieldExpenses: vi.fn(async () => ({ expenses: [] })),
  serviceIssues: vi.fn(async () => ({ issues: [] })),
  leaveRequests: vi.fn(async () => ({ requests: [] })),
  sapStatus: vi.fn(async () => ({ outbox: { failed: 0 } })),
}));

vi.mock("../../useAuth", () => ({
  useAuth: () => ({ admin: { name: "Ops Admin" }, loading: false, permissions: auth.permissions, logout: vi.fn() }),
}));
vi.mock("../../AuthContext", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../api", () => ({
  api: mocks,
  inr: (value: number) => `₹${Math.round(Number(value)).toLocaleString("en-IN")}`,
}));

const placedOrder = {
  id: "order-114",
  orderNo: 114,
  status: "placed",
  createdAt: new Date(Date.now() - ((19 * 60) + 19) * 60_000).toISOString(),
  orderTotal: 18900,
  sapSyncStatus: "failed",
  retailer: { id: "retailer-1", name: "Annapurna Foods", phone: "9800000114" },
  delivery: null,
  items: [
    { id: "line-rice", variantId: "rice", qtyOrdered: 3, unitPrice: 5350, variant: { unitSize: "30 kg", unitsPerCase: 1, product: { name: "Basmati Rice" } } },
    { id: "line-dal", variantId: "dal", qtyOrdered: 1, unitPrice: 2850, variant: { unitSize: "30 kg", unitsPerCase: 1, product: { name: "Chana Dal" } } },
  ],
  commercialSnapshot: {
    total: 18111,
    lines: [
      { variantId: "rice", productName: "Basmati Rice", pack: "30 kg", total: 16111 },
      { variantId: "dal", productName: "Chana Dal", pack: "30 kg", total: 2000 },
    ],
  },
};

let placed: any[] = [placedOrder];
let confirmed: any[] = [];
let rejected: any[] = [];
let commercial: any[] = [{
  id: placedOrder.id,
  internalStatus: { currentCode: "SALES_ORDER_APPROVAL_SENT", currentLabel: "❤️ Order Approval", isOnHold: false, holdReason: null },
}];

function stageCount(name: RegExp) {
  return screen.getByRole("button", { name }).querySelector(".stage-count");
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.permissions = ["staff.manage"];
  placed = [placedOrder];
  confirmed = [];
  rejected = [];
  commercial = [{
    id: placedOrder.id,
    internalStatus: { currentCode: "SALES_ORDER_APPROVAL_SENT", currentLabel: "❤️ Order Approval", isOnHold: false, holdReason: null },
  }];
  mocks.orders.mockImplementation(async (status?: string) => {
    if (status === "placed") return { orders: placed };
    if (status === "confirmed") return { orders: confirmed };
    if (status === "rejected") return { orders: rejected };
    return { orders: [] };
  });
  mocks.commercialStatuses.mockImplementation(async () => ({ orders: commercial }));
  mocks.approve.mockResolvedValue({ order: { ...placedOrder, status: "confirmed" } });
  mocks.reject.mockResolvedValue({ order: { ...placedOrder, status: "rejected" } });
  mocks.holdOrder.mockResolvedValue({ status: { isOnHold: true, currentCode: "SALES_ORDER_ON_HOLD", currentLabel: "❌ Sales Order On Hold", holdReason: "Waiting for retailer" } });
  mocks.warehouseOrders.mockResolvedValue({ orders: [] });
});

function renderOrders() {
  return render(<MemoryRouter><Orders /></MemoryRouter>);
}

async function openReview() {
  fireEvent.click(await screen.findByRole("button", { name: /GGN-00000114/ }));
  return screen.findByRole("dialog", { name: "GGN-00000114" });
}

describe("admin order review modal", () => {
  it("opens the review modal from the order row without the full workspace", async () => {
    renderOrders();
    expect(await screen.findByRole("button", { name: /Annapurna Foods/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Selected order workspace" })).not.toBeInTheDocument();

    const dialog = await openReview();

    expect(dialog).toHaveTextContent("Annapurna Foods");
    expect(dialog).toHaveTextContent(/Placed \d+h \d+m ago/);
    expect(dialog).toHaveTextContent("₹18,900");
    expect(dialog).toHaveTextContent("2 items");
    expect(dialog).toHaveTextContent("❤️ Order Approval");
    expect(dialog).toHaveTextContent("Approve or reject this order.");
    expect(dialog).toHaveTextContent("Commercial approval is the current dependency.");
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Selected order workspace" })).not.toBeInTheDocument();
  });

  it("shows stored commercial lines and the canonical order total", async () => {
    renderOrders();
    const dialog = await openReview();
    const rice = within(dialog).getByText("Basmati Rice").closest(".order-review-line");
    const dal = within(dialog).getByText("Chana Dal").closest(".order-review-line");

    expect(rice).toHaveTextContent("30 kg");
    expect(rice).toHaveTextContent("3");
    expect(rice).toHaveTextContent("₹5,350");
    expect(rice).toHaveTextContent("₹16,111");
    expect(rice).not.toHaveTextContent("₹16,050");
    expect(dal).toHaveTextContent("₹2,850");
    expect(dal).toHaveTextContent("₹2,000");
    expect(dialog).toHaveTextContent("Needs action");
    expect(dialog).toHaveTextContent("Review required");
    expect(dialog).toHaveTextContent("Not exposed");
    expect(dialog).toHaveTextContent("Waiting");
    expect(dialog).toHaveTextContent("Not assigned");
    expect(dialog).toHaveTextContent("Sync failed");
    expect(dialog).not.toHaveTextContent("₹18,111");
  });

  it("keeps approval controls outside the scrolling details", async () => {
    renderOrders();
    await openReview();
    const approve = screen.getByRole("button", { name: /^Approve$/ });
    expect(screen.getByRole("region", { name: "Order review details" }).contains(approve)).toBe(false);
    expect(screen.getByRole("contentinfo", { name: "Order actions" }).contains(approve)).toBe(true);
    expect(screen.getByRole("button", { name: /^Reject$/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Put on hold$/ })).toBeEnabled();
  });

  it("approves through the canonical action and ignores a second click while it is in flight", async () => {
    let resolveApprove: (value: unknown) => void = () => {};
    mocks.approve.mockImplementation(() => new Promise((resolve) => { resolveApprove = resolve; }));
    renderOrders();
    await openReview();
    const approve = screen.getByRole("button", { name: /^Approve$/ });
    fireEvent.click(approve);
    fireEvent.click(approve);

    expect(await screen.findByRole("button", { name: /^Approving…$/ })).toBeDisabled();
    expect(mocks.approve).toHaveBeenCalledTimes(1);
    expect(mocks.approve).toHaveBeenCalledWith("order-114");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "GGN-00000114" })).toBeInTheDocument();

    placed = [];
    confirmed = [{ ...placedOrder, status: "confirmed" }];
    resolveApprove({ order: confirmed[0] });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: /GGN-00000114/ })).toHaveClass("row-approved"));
    expect(stageCount(/Awaiting approval/)).toHaveTextContent("0");
    expect(stageCount(/Confirmed/)).toHaveTextContent("1");
    const summary = screen.getByRole("region", { name: "Queue health" });
    expect(within(summary).getByText("₹0")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: /GGN-00000114/ })).not.toBeInTheDocument());
  });

  it("rejects through the canonical action and removes the order from awaiting approval", async () => {
    mocks.reject.mockImplementation(async () => {
      const next = { ...placedOrder, status: "rejected" };
      placed = [];
      rejected = [next];
      return { order: next };
    });
    renderOrders();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: /^Reject$/ }));

    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith("order-114"));
    await waitFor(() => expect(screen.getByRole("button", { name: /GGN-00000114/ })).toHaveClass("row-rejected"));
    expect(stageCount(/Rejected/)).toHaveTextContent("1");
    expect(stageCount(/Awaiting approval/)).toHaveTextContent("0");
    await waitFor(() => expect(screen.queryByRole("button", { name: /GGN-00000114/ })).not.toBeInTheDocument());
  });

  it("collects a hold reason and keeps the held order in the queue", async () => {
    mocks.holdOrder.mockImplementation(async (_id: string, reason: string) => {
      const status = { isOnHold: true, currentCode: "SALES_ORDER_ON_HOLD", currentLabel: "❌ Sales Order On Hold", holdReason: reason };
      commercial = [{ id: placedOrder.id, internalStatus: status }];
      return { status };
    });
    renderOrders();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: /^Put on hold$/ }));
    fireEvent.change(screen.getByLabelText("Hold reason"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm hold$/ }));

    expect(mocks.holdOrder).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Reason must be at least 3 characters.");

    fireEvent.change(screen.getByLabelText("Hold reason"), { target: { value: "Waiting for retailer" } });
    fireEvent.click(screen.getByRole("button", { name: /^Confirm hold$/ }));

    await waitFor(() => expect(mocks.holdOrder).toHaveBeenCalledWith("order-114", "Waiting for retailer"));
    await waitFor(() => expect(screen.getByRole("button", { name: /GGN-00000114/ })).toHaveClass("row-hold"));
    expect(stageCount(/Awaiting approval/)).toHaveTextContent("1");
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(screen.getByRole("button", { name: /GGN-00000114/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GGN-00000114/ })).toHaveClass("row-hold");
  });

  it("leaves the order unchanged when approval fails", async () => {
    mocks.approve.mockRejectedValue(new Error("dispatch_authorization_required"));
    renderOrders();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: /^Approve$/ }));

    expect(await screen.findByText("dispatch_authorization_required")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "GGN-00000114" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GGN-00000114/ })).toHaveClass("row-awaiting");
    expect(stageCount(/Awaiting approval/)).toHaveTextContent("1");
    expect(stageCount(/Confirmed/)).toHaveTextContent("0");
    expect(mocks.approve).toHaveBeenCalledTimes(1);
  });

  it("keeps the full order workspace available from the modal", async () => {
    renderOrders();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: "Open full order details" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const workspace = await screen.findByRole("region", { name: "Selected order workspace" });
    expect(within(workspace).getByRole("link", { name: /Financial ledger/ })).toHaveAttribute("href", "/ledger");
    expect(within(workspace).getByRole("link", { name: /Retailer account/ })).toHaveAttribute("href", "/retailers");
    expect(within(workspace).getAllByRole("button", { name: /^Approve$/ }).length).toBeGreaterThan(0);
  });

  it("moves focus into the modal and returns it to the order row", async () => {
    renderOrders();
    const row = await screen.findByRole("button", { name: /GGN-00000114/ });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    const dialog = await screen.findByRole("dialog", { name: "GGN-00000114" });
    await waitFor(() => expect(dialog).toHaveFocus());

    const buttons = Array.from(dialog.querySelectorAll("button"));
    const last = buttons[buttons.length - 1] as HTMLButtonElement;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(row).toHaveFocus();

    row.focus();
    fireEvent.keyDown(row, { key: " " });
    expect(await screen.findByRole("dialog", { name: "GGN-00000114" })).toBeInTheDocument();
  });
});

describe("order review authorization", () => {
  it("does not give warehouse processing the commercial review actions", async () => {
    mocks.warehouseOrders.mockResolvedValue({ orders: [] });
    render(<MemoryRouter><Orders mode="warehouse" /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Warehouse orders" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens order actions for Client UAT Ops without staff.manage", async () => {
    auth.permissions = ["order.warehouse_process", "dispatch.execute", "commercial.status.view"];
    window.history.replaceState({}, "", "/orders");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /GGN-00000114/ }));
    expect(await screen.findByRole("button", { name: /^Approve$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reject$/ })).toBeInTheDocument();
  });
});
