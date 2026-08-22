import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LanguageCode } from "./languageState";

export const SALES_LANGUAGE_KEY = "gagan.language.sales";

export interface LanguageStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === "en" || value === "hi";
}

export function createLanguageStore(storage: LanguageStorage, key: string) {
  return {
    async loadLanguage(): Promise<LanguageCode | null> {
      const value = await storage.getItem(key);
      return isLanguageCode(value) ? value : null;
    },
    async saveLanguage(language: LanguageCode): Promise<void> {
      await storage.setItem(key, language);
    },
  };
}

export const salesLanguageStore = createLanguageStore(AsyncStorage, SALES_LANGUAGE_KEY);
