import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../AuthContext";
import { useAuth } from "../useAuth";
import { api, clearAccessToken } from "../api";

vi.mock("../api", () => ({
  api: {
    refresh: vi.fn(),
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

function Probe() {
  const { admin, loading, logout } = useAuth();
  if (loading) return <span>Loading</span>;
  return (
    <div>
      <span>{admin?.name ?? "Signed out"}</span>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

describe("admin auth context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.refresh).mockResolvedValue("fresh-access");
    vi.mocked(api.me).mockResolvedValue({
      admin: { id: "admin-1", name: "Ops Admin", email: "admin@gagan.test" },
    });
    vi.mocked(api.logout).mockResolvedValue({});
  });

  it("restores a browser session from the HttpOnly refresh cookie", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("Ops Admin")).toBeInTheDocument();
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(api.me).toHaveBeenCalledOnce();
  });

  it("revokes the server session before clearing in-memory access", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("Ops Admin");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(api.logout).toHaveBeenCalledOnce());
    expect(clearAccessToken).toHaveBeenCalled();
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
  });
});
