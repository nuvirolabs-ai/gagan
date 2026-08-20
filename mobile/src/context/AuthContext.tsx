import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from "../api/client";

interface RetailerInfo {
  id: string;
  name: string;
  phone: string;
}

interface AuthContextValue {
  retailer: RetailerInfo | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [retailer, setRetailer] = useState<RetailerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setRetailer(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Rebuild the session from the stored token. Screens key off retailer.id, so
  // this must resolve to the real record rather than a placeholder.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        setRetailer(res.retailer);
      } catch {
        await clearToken();
        setRetailer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestOtp = async (phone: string) => {
    await api.requestOtp(phone);
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await api.verifyOtp(phone, otp);
    await setToken(res.token);
    setRetailer({ id: res.retailer.id, name: res.retailer.name, phone });
  };

  const logout = async () => {
    await clearToken();
    setRetailer(null);
  };

  return (
    <AuthContext.Provider value={{ retailer, loading, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
