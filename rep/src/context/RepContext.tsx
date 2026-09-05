import React, { createContext, useContext, useEffect, useState } from "react";
import {
  repApi,
  staffSessionStore,
  setRepUnauthorizedHandler,
} from "../api/repClient";
import { CartLine } from "../types";
import { isAuthenticationFailure } from "../auth/sessionFetch";
import { isRecoverableOtpError } from "../auth/otpErrors";
import { staffIdentityCache } from "../auth/identityCache";
import { useLanguage } from "../i18n/LanguageContext";

interface Rep {
  id: string;
  name: string;
  phone: string;
}

export interface StaffIdentity {
  id: string;
  name: string;
  phone: string;
  email: string;
  permissions: string[];
}

interface RepContextValue {
  rep: Rep | null;
  staff: StaffIdentity | null;
  loading: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<string>;
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
  const { beginLoginSelection, resetSelectionGate } = useLanguage();
  const [rep, setRep] = useState<Rep | null>(null);
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRetailerId, setActiveRetailerId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setRepUnauthorizedHandler(() => {
      void staffIdentityCache.clear();
      setRep(null);
      setStaff(null);
      resetSelectionGate();
    });
    return () => setRepUnauthorizedHandler(null);
  }, [resetSelectionGate]);

  useEffect(() => {
    (async () => {
      const session = await staffSessionStore.load();
      if (!session) {
        setLoading(false);
        return;
      }
      try {
        const res = await repApi.me();
        setStaff(res.staff);
        setRep(res.rep);
        await staffIdentityCache.save({ staff: res.staff, rep: res.rep ?? null });
      } catch (error) {
        // A salesperson opening the app in a dead zone must not be signed out:
        // only the server rejecting the session ends it. Anything else — no
        // signal, a 5xx — falls back to the last identity the server confirmed
        // so the day's work can continue and sync later.
        if (isAuthenticationFailure(error)) {
          await staffSessionStore.clear();
          await staffIdentityCache.clear();
          setStaff(null);
          setRep(null);
        } else {
          const cached = await staffIdentityCache.load();
          if (cached) {
            setStaff(cached.staff);
            setRep(cached.rep);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requestOtp = async (phone: string) => {
    const result = await repApi.requestOtp(phone);
    if (typeof result.challengeId !== "string") throw new Error("Could not start OTP challenge");
    setChallengeId(result.challengeId);
    return result.challengeId;
  };

  const acceptSession = async (res: { staff: StaffIdentity; rep: Rep | null }) => {
    setChallengeId(null);
    setStaff(res.staff);
    setRep(res.rep);
    await staffIdentityCache.save({ staff: res.staff, rep: res.rep ?? null });
    beginLoginSelection();
  };

  const login = async (phone: string, otp: string) => {
    const verify = async (id: string) => acceptSession(await repApi.verifyOtp(id, phone, otp));
    try {
      const id = challengeId ?? (await requestOtp(phone));
      await verify(id);
    } catch (error) {
      if (!isRecoverableOtpError(error)) throw error;
      await verify(await requestOtp(phone));
    }
  };

  const logout = async () => {
    try {
      await repApi.logout();
    } finally {
      await staffIdentityCache.clear();
      setChallengeId(null);
      setStaff(null);
      setRep(null);
      resetSelectionGate();
      setActiveRetailerId(null);
      setLines([]);
    }
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
        staff,
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
