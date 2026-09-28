import { beforeEach, describe, expect, it } from "vitest";
import { clearRecentAdminSearches, searchAdmin } from "../adminSearch";

const staff = ["staff.manage"] as const;
const broad = ["staff.manage", "performance.view_team", "feedback.review", "approval.second_invoice", "order.warehouse_process"] as const;

beforeEach(() => clearRecentAdminSearches());

describe("admin search", () => {
  it("matches catalog spelling, inventory, salesman, and approve order", () => {
    expect(searchAdmin("catlog", { permissions: staff, pathname: "/orders" }).map((item) => item.id)).toContain("catalog");
    expect(searchAdmin("Catalog", { permissions: staff, pathname: "/" }).some((item) => item.id === "catalog")).toBe(true);
    const salesman = searchAdmin("salesman", { permissions: broad, pathname: "/" }).map((item) => item.id);
    expect(salesman).toEqual(expect.arrayContaining(["staff", "sales-leader", "salesperson-feedback"]));
    const inventory = searchAdmin("inventory", { permissions: staff, pathname: "/catalog" }).map((item) => item.id);
    expect(inventory).toEqual(expect.arrayContaining(["catalog", "imports", "import-inventory"]));
    expect(inventory[0]).toBe("catalog");
    const approval = searchAdmin("approve order", { permissions: broad, pathname: "/" }).map((item) => item.id);
    expect(approval).toEqual(expect.arrayContaining(["orders", "approvals", "approve-order"]));
  });

  it("filters by permission and keeps catalogue identity unavailable", () => {
    const limited = searchAdmin("salesman", { permissions: staff, pathname: "/" }).map((item) => item.id);
    expect(limited).toContain("staff");
    expect(limited).not.toContain("sales-leader");
    expect(limited).not.toContain("salesperson-feedback");
    expect(searchAdmin("orders", { permissions: ["survey.manage"], pathname: "/market-surveys" })).toEqual([]);
    expect(searchAdmin("catalogue identity", { permissions: ["survey.manage"], pathname: "/catalog" })).toEqual([]);
    const identity = searchAdmin("catalogue identity", { permissions: staff, pathname: "/catalog" });
    expect(identity.map((item) => item.id)).toContain("catalogue-identity");
    expect(identity.find((item) => item.id === "catalogue-identity")).toMatchObject({
      route: null,
      description: "Requires controlled catalogue publication workflow",
    });
    expect(searchAdmin("", { permissions: staff, pathname: "/catalog" }).some((item) => item.id === "catalogue-identity")).toBe(false);
    expect(searchAdmin("warehouses", { permissions: staff, pathname: "/" }).some((item) => item.route === "/warehouses")).toBe(false);
  });

  it("ranks the current page first without hiding other permitted pages", () => {
    const onCatalog = searchAdmin("", { permissions: staff, pathname: "/catalog" });
    expect(onCatalog[0]?.id).toBe("catalog");
    expect(onCatalog.some((item) => item.id === "orders")).toBe(true);
    expect(searchAdmin("", { permissions: staff, pathname: "/orders" })[0]?.id).toBe("orders");
    expect(searchAdmin("inventry", { permissions: staff, pathname: "/imports" }).some((item) => item.id === "imports")).toBe(true);
  });
});
