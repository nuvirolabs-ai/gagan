import { CATALOGUE_IDENTITY_UNAVAILABLE } from "./navigation";

export const INVENTORY_IMPORT_ROUTE = "/imports?type=inventory";
export const CATALOGUE_IDENTITY_DETAIL = "Requires controlled catalogue publication workflow";

type SectionId = "gst" | "price" | "billing" | "stock" | "packing";

export type OrderingBlockerView =
  | { kind: "focus"; label: string; section: SectionId; focus: "control" | "section"; controlId?: string; supersedeLive: boolean }
  | { kind: "navigate"; label: string; to: string; section: SectionId }
  | { kind: "reload"; label: string; section: SectionId }
  | { kind: "unavailable"; title: string; detail: string; section: SectionId }
  | { kind: "note"; note: string; section?: SectionId }
  | { kind: "status"; section?: SectionId };

const BLOCKERS: Record<string, OrderingBlockerView> = {
  "Select an approved GST rate.": { kind: "focus", label: "Set GST rate", section: "gst", focus: "control", controlId: "ordering-gst-rate", supersedeLive: true },
  "Set a positive rate for each applicable price tier.": { kind: "focus", label: "Set selling price", section: "price", focus: "section", supersedeLive: true },
  "Select the approved billing rule.": { kind: "focus", label: "Set billing rule", section: "billing", focus: "section", supersedeLive: true },
  "Dynamic routing cannot also have a fixed selling company.": { kind: "focus", label: "Set billing rule", section: "billing", focus: "section", supersedeLive: true },
  "Enter the approved bag equivalent for Other routing.": { kind: "focus", label: "Set billing rule", section: "billing", focus: "section", supersedeLive: true },
  "Remove the bag equivalent for this routing rule.": { kind: "focus", label: "Set billing rule", section: "billing", focus: "section", supersedeLive: true },
  "Linked warehouse stock is unavailable. Use the authorised inventory import or refresh.": { kind: "navigate", label: "Open inventory import", to: INVENTORY_IMPORT_ROUTE, section: "stock" },
  "Stock verification has expired. Refresh stock through the authorised inventory flow.": { kind: "navigate", label: "Open inventory import", to: INVENTORY_IMPORT_ROUTE, section: "stock" },
  "This pack is out of stock.": { kind: "status", section: "stock" },
  "Approved catalogue identity is missing.": { kind: "unavailable", title: CATALOGUE_IDENTITY_UNAVAILABLE, detail: CATALOGUE_IDENTITY_DETAIL, section: "packing" },
  "Approved pack image is missing.": { kind: "note", note: "Approved pack image is not assigned in this panel.", section: "packing" },
  "Approved pack conversion is missing.": { kind: "note", note: "Approved pack conversions cannot be changed in this panel.", section: "packing" },
  "Pack is not in an editable catalogue state.": { kind: "note", note: "This pack is not in an editable catalogue state.", section: "packing" },
  "Price tier selection changed. Reload setup.": { kind: "reload", label: "Reload setup", section: "price" },
};

export function interpretOrderingBlocker(message: string): OrderingBlockerView {
  return BLOCKERS[message] ?? { kind: "status" };
}

export function blockerSection(message: string) {
  const view = interpretOrderingBlocker(message);
  return "section" in view ? view.section : undefined;
}
