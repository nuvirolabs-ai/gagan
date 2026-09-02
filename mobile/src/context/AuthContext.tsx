import React, { createContext, useContext, useEffect, useState } from "react";
import { api, retailerSessionStore, setUnauthorizedHandler } from "../api/client";
import { retailerIdentityCache } from "../auth/identityCache";
import { isAuthenticationFailure } from "../auth/sessionFetch";
import { useLanguage } from "../i18n/LanguageContext";

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
  const { beginLoginSelection, resetSelectionGate } = useLanguage();
  const [retailer, setRetailer] = useState<RetailerInfo | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setRetailer(null);
      void retailerIdentityCache.clear();
      resetSelectionGate();
    });
    return () => setUnauthorizedHandler(null);
  }, [resetSelectionGate]);

  // Rebuild the session from the stored token. Screens key off retailer.id, so
  // this must resolve to the real record rather than a placeholder.
  useEffect(() => {
    (async () => {
      const session = await retailerSessionStore.load();
      if (!session) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.me();
        const next = { id: res.retailer.id, name: res.retailer.name, phone: res.retailer.phone ?? "" };
        setRetailer(next);
        await retailerIdentityCache.save(next);
      } catch (error) {
        // Only the server refusing the session ends it. A shop with no signal
        // keeps its stored session so it can order as soon as it reconnects,
        // rather than being asked for an OTP it cannot receive.
        if (isAuthenticationFailure(error)) {
          await retailerSessionStore.clear();
          await retailerIdentityCache.clear();
          setRetailer(null);
        } else {
          const cached = await retailerIdentityCache.load();
          if (cached) setRetailer({ id: cached.id, name: cached.name, phone: cached.phone });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestOtp = async (phone: string) => {
    const result = await api.requestOtp(phone);
    if (typeof result.challengeId !== "string") throw new Error("Could not start OTP challenge");
    setChallengeId(result.challengeId);
  };

  const verifyOtp = async (phone: string, otp: string) => {
    if (!challengeId) throw new Error("Request a new OTP first");
    const res = await api.verifyOtp(challengeId, phone, otp);
    setChallengeId(null);
    const next = { id: res.retailer.id, name: res.retailer.name, phone };
    setRetailer(next);
    await retailerIdentityCache.save(next);
    beginLoginSelection();
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setChallengeId(null);
      setRetailer(null);
      await retailerIdentityCache.clear();
      resetSelectionGate();
    }
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
