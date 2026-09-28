import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../App";
import CommandPalette from "../components/CommandPalette";
import OrderingSetupPanel from "../pages/OrderingSetupPanel";

const auth = vi.hoisted(() => ({ permissions: ["staff.manage"] as string[] }));
vi.mock("../AuthContext", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../useAuth", () => ({ useAuth: () => ({ admin: { name: "Ops Admin" }, loading: false, permissions: auth.permissions, logout: vi.fn() }) }));
vi.mock("../pages/MarketSurveys", () => ({ default: () => <h1>Survey page</h1> }));
vi.mock("../pages/Catalog", () => ({ default: () => <h1>Catalog page</h1> }));
vi.mock("../pages/Orders", () => ({ default: () => <h1>Orders page</h1> }));
vi.mock("../pages/ImportCenter", () => ({ default: () => <h1>Import page</h1> }));
vi.mock("../pages/Dashboard", () => ({ default: () => <h1>Work page</h1> }));
vi.mock("../api", () => ({
  api: { orderingSetup: vi.fn(async () => ({
    revision: "a".repeat(64),
    product: { name: "Gagan Excellent" },
    pack: { id: "pack-one", label: "5 KG × 4", unitWeightKg: 5, unitsPerCase: 4, caseWeightKg: 20, status: "published" },
    tiers: [{ id: "gold", name: "Gold" }],
    inventory: null,
    values: { gstPercent: "5", sellingEntity: "jain_traders", routingClass: null, routingBagEquivalent: null, prices: [{ tierId: "gold", rate: "10", rateBasis: "case" }] },
    effective: { gstPercent: "5", sellingEntity: "jain_traders", routingClass: null, routingBagEquivalent: null, prices: [{ tierId: "gold", rate: "10", rateBasis: "case" }] },
    hasDraft: false,
    gstPendingException: false,
    blockers: ["Approved catalogue identity is missing."],
  })) },
  ApiError: class ApiError extends Error {},
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPalette(path = "/catalog") {
  return render(<MemoryRouter initialEntries={[path]}><CommandPalette /><LocationProbe /></MemoryRouter>);
}

beforeEach(() => { auth.permissions = ["staff.manage"]; });

describe("command palette", () => {
  it("opens from the search box, Ctrl+K, and Command+K, then restores focus", async () => {
    renderPalette();
    const field = screen.getByRole("combobox", { name: "Search Gagan" });
    expect(field).toHaveAttribute("placeholder", "Type to search");
    fireEvent.focus(field);
    expect(await screen.findByRole("dialog", { name: "Search Gagan" })).toBeInTheDocument();
    expect(field).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search Gagan" })).not.toBeInTheDocument());

    field.blur();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    await waitFor(() => expect(field).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Search Gagan" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search Gagan" })).not.toBeInTheDocument());

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => expect(field).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Search Gagan" })).toBeInTheDocument();
  });

  it("navigates with the keyboard and leaves catalogue identity in place", async () => {
    renderPalette("/orders");
    fireEvent.focus(screen.getByRole("combobox", { name: "Search Gagan" }));
    const input = await screen.findByRole("combobox", { name: "Search Gagan" });
    fireEvent.change(input, { target: { value: "catlog" } });
    await waitFor(() => expect(document.getElementById("command-option-catalog")).toHaveAttribute("aria-selected", "true"));
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/catalog"));

    fireEvent.focus(screen.getByRole("combobox", { name: "Search Gagan" }));
    const next = await screen.findByRole("combobox", { name: "Search Gagan" });
    fireEvent.change(next, { target: { value: "import" } });
    await screen.findByRole("option", { name: /Data import/ });
    fireEvent.keyDown(next, { key: "ArrowDown" });
    expect(next).toHaveAttribute("aria-activedescendant", "command-option-import-inventory");
    fireEvent.keyDown(next, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/imports?type=inventory"));

    fireEvent.focus(screen.getByRole("combobox", { name: "Search Gagan" }));
    const identityInput = await screen.findByRole("combobox", { name: "Search Gagan" });
    fireEvent.change(identityInput, { target: { value: "catalogue identity" } });
    expect(await screen.findByText("Not available in Admin")).toBeInTheDocument();
    expect(screen.getByText("Requires controlled catalogue publication workflow")).toBeInTheDocument();
    const identity = document.getElementById("command-option-catalogue-identity");
    expect(identity?.closest("a, button")).toBeNull();
    fireEvent.keyDown(identityInput, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/imports?type=inventory");
    expect(screen.getByRole("dialog", { name: "Search Gagan" })).toBeInTheDocument();
  });

  it("hides actions the operator cannot open", async () => {
    auth.permissions = ["survey.manage"];
    renderPalette("/market-surveys");
    fireEvent.focus(screen.getByRole("combobox", { name: "Search Gagan" }));
    const input = await screen.findByRole("combobox", { name: "Search Gagan" });
    fireEvent.change(input, { target: { value: "orders" } });
    expect(await screen.findByText("No matching Admin action found.")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Orders/ })).toBeNull();
    fireEvent.change(input, { target: { value: "catalogue identity" } });
    expect(screen.queryByText("Not available in Admin")).toBeNull();
    expect(screen.getByText("No matching Admin action found.")).toBeInTheDocument();
  });

  it("lets the ordering panel receive Escape only after search closes", async () => {
    const onClose = vi.fn();
    render(<MemoryRouter><CommandPalette /><OrderingSetupPanel variantId="pack-one" onClose={onClose} onSaved={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByRole("dialog", { name: "Set up ordering" })).toBeInTheDocument();
    const trigger = screen.getByRole("combobox", { name: "Search Gagan" });
    fireEvent.focus(trigger);
    expect(await screen.findByRole("dialog", { name: "Search Gagan" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Search Gagan" })).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Set up ordering" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("admin shell search", () => {
  it("shows Search Gagan and keeps direct routes behind permissions", async () => {
    window.history.replaceState({}, "", "/no-access");
    const view = render(<App />);
    expect(screen.getByRole("combobox", { name: /Search Gagan/ })).toHaveAttribute("placeholder", "Type to search");
    view.unmount();

    auth.permissions = ["survey.manage"];
    window.history.replaceState({}, "", "/orders");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Survey page" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
    expect(screen.getByRole("link", { name: "Market surveys" })).toBeInTheDocument();
  });
});
