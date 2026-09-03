export const IMPORT_TYPES = [
  "retailers",
  "products",
  "salespeople",
  "assignments",
  "inventory",
  "pricing",
  "sap_mappings",
] as const;

export type ImportType = (typeof IMPORT_TYPES)[number];
export type ImportMode = "upsert" | "create_only" | "update_only";

export const IMPORT_DEFINITIONS: Record<ImportType, {
  label: string;
  description: string;
  required: string[];
  optional: string[];
  example: Record<string, string>;
}> = {
  retailers: {
    label: "Retailers",
    description: "Retailer master data and commercial settings.",
    required: ["name", "phone", "shop_address", "tier"],
    optional: ["credit_limit", "salesperson_employee_ref", "sap_customer_id"],
    example: {
      name: "Import QA Kirana",
      phone: "9899999901",
      shop_address: "18 Market Road, Indore",
      tier: "Gold",
      credit_limit: "50000",
      salesperson_employee_ref: "SALES-001",
      sap_customer_id: "CUST-IMPORT-001",
    },
  },
  products: {
    label: "Products / SKUs",
    description: "Product master rows. Each row represents one sellable variant.",
    required: ["product_name", "category", "unit_size", "unit", "units_per_case", "unit_weight_kg"],
    optional: ["description", "image_url", "sap_material_id"],
    example: {
      product_name: "Gagan Toor Dal",
      category: "Daal",
      description: "Premium split pigeon peas",
      image_url: "https://example.invalid/gagan-toor-dal-1kg.jpg",
      sap_material_id: "MAT-IMPORT-001",
      unit_size: "1 kg",
      unit: "kg",
      units_per_case: "30",
      unit_weight_kg: "1",
    },
  },
  salespeople: {
    label: "Salespeople",
    description: "Staff identities linked to the existing salesperson model.",
    required: ["name", "phone", "email", "employee_ref"],
    optional: ["territory", "manager_employee_ref", "status"],
    example: {
      name: "Import QA Salesperson",
      phone: "9899999902",
      email: "import-qa-sales@gagan.test",
      employee_ref: "IMPORT-SALES-001",
      territory: "Indore East",
      manager_employee_ref: "MGR-001",
      status: "active",
    },
  },
  assignments: {
    label: "Retailer assignments",
    description: "Connect an existing retailer to an existing salesperson.",
    required: ["retailer_phone", "salesperson_employee_ref"],
    optional: [],
    example: { retailer_phone: "9812345678", salesperson_employee_ref: "SALES-001" },
  },
  inventory: {
    label: "Inventory",
    description: "Warehouse inventory snapshots using the canonical stock calculation.",
    required: ["warehouse_code", "sap_material_id", "product_name", "unit_size", "on_hand"],
    optional: ["committed", "synced_at"],
    example: {
      warehouse_code: "WH-001",
      sap_material_id: "MAT-IMPORT-001",
      product_name: "Gagan Toor Dal",
      unit_size: "1 kg",
      on_hand: "240",
      committed: "12",
      synced_at: "2026-09-03T09:00:00.000Z",
    },
  },
  pricing: {
    label: "Pricing",
    description: "Tier price rows for an existing sellable variant.",
    required: ["tier", "product_name", "unit_size", "price"],
    optional: [],
    example: { tier: "Gold", product_name: "Gagan Toor Dal", unit_size: "1 kg", price: "3150" },
  },
  sap_mappings: {
    label: "SAP mappings",
    description: "Prepare canonical retailer/product identifiers for a future SAP connector.",
    required: ["entity_type", "gagan_key", "sap_code"],
    optional: [],
    example: { entity_type: "retailer", gagan_key: "9812345678", sap_code: "CUST-0001" },
  },
};

export function allHeaders(type: ImportType) {
  return [...IMPORT_DEFINITIONS[type].required, ...IMPORT_DEFINITIONS[type].optional];
}
