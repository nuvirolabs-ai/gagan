import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { founderApi, setUnauthorizedHandler } from "../api/founder";
import { SessionFetchError } from "../auth/sessionFetch";

interface FounderIdentity {
  id: string;
  name: string;
  phone: string;
  permissions: string[];
}

interface AuthValue {
  ready: boolean;
  identity: FounderIdentity | null;
  denied: boolean;
  requestOtp: (phone: string) => Promise<{ challengeId?: string }>;
  verifyOtp: (input: { challengeId: string; phone: string; otp: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function hasFounderView(permissions: string[]) {
  return permissions.includes("founder.view");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<FounderIdentity | null>(null);
  const [denied, setDenied] = useState(false);

  const signOut = useCallback(async () => {
    await founderApi.store.clear();
    setIdentity(null);
    setDenied(false);
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const tokens = await founderApi.store.load();
      if (!tokens) return;
      const body = await founderApi.me();
      const staff = body.staff;
      const permissions: string[] = body.permissions ?? [];
      if (!hasFounderView(permissions)) {
        setDenied(true);
        await founderApi.store.clear();
        return;
      }
      setIdentity({
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        permissions,
      });
    } catch {
      await founderApi.store.clear();
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIdentity(null);
    });
    void hydrate().finally(() => setReady(true));
  }, [hydrate]);

  const requestOtp = useCallback(async (phone: string) => {
    return founderApi.requestOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (input: { challengeId: string; phone: string; otp: string }) => {
    const body = await founderApi.verifyOtp(input);
    const permissions: string[] = body.staff?.permissions ?? [];
    await founderApi.store.save({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    });
    if (!hasFounderView(permissions)) {
      await founderApi.store.clear();
      setDenied(true);
      throw new SessionFetchError(403, { error: "permission_required" });
    }
    setDenied(false);
    setIdentity({
      id: body.staff.id,
      name: body.staff.name,
      phone: body.staff.phone,
      permissions,
    });
  }, []);

  const value = useMemo(
    () => ({ ready, identity, denied, requestOtp, verifyOtp, signOut }),
    [ready, identity, denied, requestOtp, verifyOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
