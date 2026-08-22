export type LanguageCode = "en" | "hi";

export interface LanguageState {
  language: LanguageCode;
  selectionRequired: boolean;
}

export function beginLogin(state: LanguageState): LanguageState {
  return { ...state, selectionRequired: true };
}

export function completeSelection(state: LanguageState, language: LanguageCode): LanguageState {
  return { language, selectionRequired: false };
}

export function restoreSession(language: LanguageCode | null): LanguageState {
  return { language: language ?? "en", selectionRequired: false };
}

export function logout(state: LanguageState): LanguageState {
  return { ...state, selectionRequired: false };
}
