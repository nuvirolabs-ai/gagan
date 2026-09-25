import type { TranslationKey } from "../i18n/translations";

const CHECK_IN_ERROR_KEYS: Record<string, TranslationKey> = {
  visit_already_open: "visit.checkInAlreadyOpen",
  invalid_location_coordinates: "visit.checkInLocationInvalid",
  retailer_not_assigned: "visit.checkInRetailerNotAssigned",
};

export function checkInErrorKey(error: unknown): TranslationKey {
  const code = error instanceof Error ? error.message : "";
  return CHECK_IN_ERROR_KEYS[code] ?? "visit.checkInFailed";
}
