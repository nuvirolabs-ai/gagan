import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { environmentLabel } from "../environmentLabel";

const authState = vi.hoisted(() => ({ loading: false }));
vi.mock("../AuthContext", () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../useAuth", () => ({ useAuth: () => ({
  admin: { name: "Ops Admin" }, loading: authState.loading, permissions: [], logout: vi.fn(),
}) }));

import App from "../App";

describe("Admin environment badge", () => {
  it("labels the local shell without claiming write access is disabled", () => {
    authState.loading = false;
    window.history.replaceState({}, "", "/no-access");
    render(<App />);
    expect(screen.getByText("local development")).toBeInTheDocument();
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
  });

  it("uses the same truthful label while loading", () => {
    authState.loading = true;
    render(<App />);
    expect(screen.getByText("local development")).toBeInTheDocument();
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument();
    authState.loading = false;
  });

  it.each([
    [{ DEV: true, VITE_APP_ENV: "staging" }, "local development"],
    [{ DEV: false, VITE_APP_ENV: "staging" }, "staging"],
    [{ DEV: false, VITE_APP_ENV: "production" }, "production"],
    [{ DEV: false }, "environment unconfigured"],
  ])("labels environment %j as %s", (config, expected) => {
    expect(environmentLabel(config)).toBe(expected);
  });
});
