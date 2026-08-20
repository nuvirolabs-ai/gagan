import React, { createContext, useContext, useEffect, useState } from "react";
import {
  repApi,
  getRepToken,
  setRepToken,
  clearRepToken,
  setRepUnauthorizedHandler,
} from "../api/repClient";
import { CartLine } from "../types";

interface Rep {
  id: string;
  name: string;
  phone: string;
}

interface RepContextValue {
  rep: Rep | null;
  loading: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  logout: () => Promise<void>;

  /** Retailer the rep is currently ordering for. */
  activeRetailerId: string | null;
  setActiveRetailer: (id: string | null) => void;

  lines: CartLine[];
  addLine: (line: CartLine) => void;
  updateQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
}

const RepContext = createContext<RepContextValue | undefined>(undefined);

export function RepProvider({ children }: { children: React.ReactNode }) {
  const [rep, setRep] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRetailerId, setActiveRetailerId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setRepUnauthorizedHandler(() => setRep(null));
    return () => setRepUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getRepToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await repApi.me();
        setRep(res.rep);
      } catch {
        await clearRepToken();
        setRep(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestOtp = async (phone: string) => {
    await repApi.requestOtp(phone);
  };

  const login = async (phone: string, otp: string) => {
    const res = await repApi.verifyOtp(phone, otp);
    await setRepToken(res.token);
    setRep(res.rep);
  };

  const logout = async () => {
    await clearRepToken();
    setRep(null);
    setActiveRetailerId(null);
    setLines([]);
  };

  // Switching retailer must drop the basket: prices are resolved per retailer's
  // tier, so carrying lines across would bill the wrong rate.
  const setActiveRetailer = (id: string | null) => {
    setActiveRetailerId((prev) => {
      if (prev !== id) setLines([]);
      return id;
    });
  };

  const addLine = (line: CartLine) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === line.variantId ? { ...l, qty: l.qty + line.qty } : l
        );
      }
      return [...prev, line];
    });

  const updateQty = (variantId: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l))
    );

  const clearCart = () => setLines([]);
  const cartTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  return (
    <RepContext.Provider
      value={{
        rep,
        loading,
        login,
        requestOtp,
        logout,
        activeRetailerId,
        setActiveRetailer,
        lines,
        addLine,
        updateQty,
        clearCart,
        cartTotal,
      }}
    >
      {children}
    </RepContext.Provider>
  );
}

export function useRep() {
  const ctx = useContext(RepContext);
  if (!ctx) throw new Error("useRep must be used within RepProvider");
  return ctx;
}
