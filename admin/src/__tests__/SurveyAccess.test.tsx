import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import App from "../App";

const state = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("../AuthContext", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../useAuth", () => ({ useAuth: () => ({ admin: { name: "Test Admin" }, loading: false, permissions: state.permissions, logout: vi.fn() }) }));
vi.mock("../pages/MarketSurveys", () => ({ default: () => <h1>Survey authorized page</h1> }));

describe("Market Survey navigation and direct route permissions", () => {
  beforeEach(() => { window.history.replaceState({}, "", "/market-surveys"); });
  it("shows the menu and allows the direct route with survey.manage", async () => {
    state.permissions = ["survey.manage"];
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Survey authorized page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Market surveys" })).toBeInTheDocument();
  });
  it("hides the menu and denies direct navigation without the permission", async () => {
    state.permissions = [];
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/no-access"));
    expect(screen.queryByRole("link", { name: "Market surveys" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Survey authorized page" })).toBeNull();
  });
});
