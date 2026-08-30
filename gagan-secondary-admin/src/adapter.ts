import { SOURCE, orders, products, retailers, warehouses } from "./data";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function checkGaganReadiness() {
  if (SOURCE !== "GAGAN_BACKEND") return { source: "DEMO_DATA" as const, ok: true, note: "Preview mode is using seeded demo records." };
  try {
    const response = await fetch(`${API_URL}/health/ready`);
    if (!response.ok) throw new Error(`Gagan readiness returned ${response.status}`);
    return { source: "GAGAN_BACKEND" as const, ok: true, note: "Gagan backend readiness endpoint is reachable." };
  } catch (error) {
    return { source: "DEMO_DATA" as const, ok: false, note: error instanceof Error ? error.message : "Gagan backend unavailable; demo records remain active." };
  }
}

export async function loadGaganReadModels() {
  if (SOURCE !== "GAGAN_BACKEND") return { source: "DEMO_DATA" as const, products, retailers, warehouses, orders };
  try {
    const response = await fetch(`${API_URL}/admin/products`, { credentials: "include" });
    if (!response.ok) throw new Error(`Gagan catalog returned ${response.status}`);
    const payload = await response.json() as { products?: unknown[] };
    return { source: "GAGAN_BACKEND" as const, products: payload.products ?? products, retailers, warehouses, orders };
  } catch {
    return { source: "DEMO_DATA" as const, products, retailers, warehouses, orders };
  }
}
