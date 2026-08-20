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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setAdmin(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // The browser only persists the HttpOnly refresh cookie. Access stays in memory.
  useEffect(() => {
    (async () => {
      try {
        await api.refresh();
        const res = await api.me();
        setAdmin(res.admin);
      } catch {
        clearAccessToken();
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setAccessToken(res.accessToken);
    setAdmin(res.admin);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      clearAccessToken();
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}
