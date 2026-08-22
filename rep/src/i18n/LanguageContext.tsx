import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { beginLogin, completeSelection, logout, restoreSession, type LanguageCode, type LanguageState } from "./languageState";
import { salesLanguageStore } from "./languageStore";
import { translate, type TranslationKey } from "./translations";

export interface LanguageContextValue {
  language: LanguageCode;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  selectionRequired: boolean;
  beginLoginSelection: () => void;
  completeLanguageSelection: (language: LanguageCode) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  resetSelectionGate: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LanguageState>({ language: "en", selectionRequired: false });

  useEffect(() => {
    let active = true;
    salesLanguageStore.loadLanguage().then((language) => {
      if (active) setState((current) => current.selectionRequired ? current : restoreSession(language));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language: state.language,
    t: (key, vars) => translate(state.language, key, vars),
    selectionRequired: state.selectionRequired,
    beginLoginSelection: () => setState((current) => beginLogin(current)),
    completeLanguageSelection: async (language) => {
      await salesLanguageStore.saveLanguage(language);
      setState((current) => completeSelection(current, language));
    },
    setLanguage: async (language) => {
      await salesLanguageStore.saveLanguage(language);
      setState((current) => ({ ...current, language }));
    },
    resetSelectionGate: () => setState((current) => logout(current)),
  }), [state]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
