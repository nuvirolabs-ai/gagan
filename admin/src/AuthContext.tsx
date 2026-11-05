import { useEffect, useState, type ReactNode } from "react";
import {
  api,
  setAccessToken,
  clearAccessToken,
  setUnauthorizedHandler,
} from "./api";
import { AuthContext, type Admin } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [modules, setModules] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAdmin(null);
      setStaffId(null);
      setPermissions([]);
      setModules(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // The browser only persists the HttpOnly refresh cookie. Access stays in memory.
  useEffect(() => {
    // Public preview builds can show the seeded dashboard without touching the
    // API. This is opt-in at build time and must never be enabled for production.
    if (import.meta.env.VITE_DEMO_MODE === "true") {
      setAdmin({ id: "demo-admin", name: "Ananya Shah", email: "demo@gagan.test" });
      setStaffId(null);
      setPermissions(["dashboard.view"]);
      setModules(null);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        await api.refresh();
        const res = await api.me();
        setAdmin(res.admin);
        setStaffId(res.staffId ?? null);
        setPermissions(res.permissions ?? []);
        setModules(res.modules ?? null);
      } catch {
        clearAccessToken();
        setAdmin(null);
        setStaffId(null);
        setPermissions([]);
        setModules(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setAccessToken(res.accessToken);
    const identity = await api.me();
    setAdmin(identity.admin);
    setStaffId(identity.staffId ?? null);
    setPermissions(identity.permissions ?? []);
    setModules(identity.modules ?? null);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      clearAccessToken();
      setAdmin(null);
      setStaffId(null);
      setPermissions([]);
      setModules(null);
    }
  };

  return (
    <AuthContext.Provider value={{ admin, staffId, permissions, modules, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
