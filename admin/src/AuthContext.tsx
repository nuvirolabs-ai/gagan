import { useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from "./api";
import { AuthContext, type Admin } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setAdmin(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore the session on reload by validating the stored token.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setAdmin(res.admin))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setAdmin(res.admin);
  };

  const logout = () => {
    clearToken();
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}
