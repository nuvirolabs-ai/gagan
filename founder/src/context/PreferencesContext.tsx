import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  schemeFrom,
  type AppearancePref,
  type FounderPreferences,
} from "../settings/preferences";
import type { TrendPeriod } from "../api/types";
import { tokensFor, type Tokens } from "../theme";

interface PreferencesValue {
  ready: boolean;
  preferences: FounderPreferences;
  scheme: "light" | "dark";
  colors: Tokens;
  setDefaultPeriod: (period: TrendPeriod) => void;
  setAppearance: (appearance: AppearancePref) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadPreferences().then((loaded) => {
      setPreferences(loaded);
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: FounderPreferences) => {
    setPreferences(next);
    void savePreferences(next);
  }, []);

  const scheme = schemeFrom(preferences.appearance, system);
  const value = useMemo(
    () => ({
      ready,
      preferences,
      scheme,
      colors: tokensFor(scheme),
      setDefaultPeriod: (defaultPeriod: TrendPeriod) => persist({ ...preferences, defaultPeriod }),
      setAppearance: (appearance: AppearancePref) => persist({ ...preferences, appearance }),
    }),
    [ready, preferences, scheme, persist]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used within PreferencesProvider");
  return value;
}
