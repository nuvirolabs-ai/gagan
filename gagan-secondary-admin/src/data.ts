export type SourceKind = "DEMO_DATA" | "GAGAN_BACKEND";

export const SOURCE: SourceKind = import.meta.env.VITE_DATA_SOURCE === "gagan" ? "GAGAN_BACKEND" : "DEMO_DATA";

export const products = [
  { name: "Gagan Toor Dal 1kg", sku: "GGN-TD-1K", category: "Daal", pack: "1 kg × 30", price: 3150, stock: 2180, cover: 24, warehouse: "Indore Main Warehouse" },
  { name: "Gagan Chana Dal 1kg", sku: "GGN-CD-1K", category: "Daal", pack: "1 kg × 30", price: 2820, stock: 1860, cover: 21, warehouse: "Indore Main Warehouse" },
  { name: "Gagan Moong Dal 1kg", sku: "GGN-MD-1K", category: "Daal", pack: "1 kg × 30", price: 3480, stock: 920, cover: 13, warehouse: "Dewas Warehouse" },
  { name: "Gagan Urad Dal 1kg", sku: "GGN-UD-1K", category: "Daal", pack: "1 kg × 30", price: 3660, stock: 1140, cover: 17, warehouse: "Indore Main Warehouse" },
  { name: "Gagan Masoor Dal 1kg", sku: "GGN-MS-1K", category: "Daal", pack: "1 kg × 30", price: 2940, stock: 780, cover: 11, warehouse: "Bhopal Distribution Centre" },
  { name: "Gagan Basmati Rice 5kg", sku: "GGN-BR-5K", category: "Rice", pack: "5 kg × 6", price: 4920, stock: 1250, cover: 19, warehouse: "Indore Main Warehouse" },
  { name: "Gagan Sona Masoori Rice 5kg", sku: "GGN-SR-5K", category: "Rice", pack: "5 kg × 6", price: 3580, stock: 640, cover: 9, warehouse: "Dewas Warehouse" },
  { name: "Gagan Chakki Atta 10kg", sku: "GGN-AT-10K", category: "Atta", pack: "10 kg × 2", price: 1180, stock: 1640, cover: 16, warehouse: "Bhopal Distribution Centre" },
  { name: "Gagan Sugar 1kg", sku: "GGN-SG-1K", category: "Sugar", pack: "1 kg × 30", price: 2100, stock: 2340, cover: 27, warehouse: "Indore Main Warehouse" },
  { name: "Gagan Poha 1kg", sku: "GGN-PH-1K", category: "Breakfast", pack: "1 kg × 20", price: 1760, stock: 420, cover: 8, warehouse: "Dewas Warehouse" },
] as const;

export const retailers = [
  { name: "Mahesh Stores", city: "Indore", tier: "Gold", outstanding: 128400, credit: 350000, orders: 28, status: "Healthy" },
  { name: "Sharma Kirana", city: "Dewas", tier: "Silver", outstanding: 68400, credit: 180000, orders: 19, status: "Healthy" },
  { name: "Gupta Traders", city: "Bhopal", tier: "Gold", outstanding: 212800, credit: 420000, orders: 34, status: "Watch" },
  { name: "Patel General Store", city: "Ujjain", tier: "Silver", outstanding: 38600, credit: 125000, orders: 12, status: "Healthy" },
  { name: "New Raj Stores", city: "Dhar", tier: "Bronze", outstanding: 92400, credit: 150000, orders: 15, status: "Review" },
] as const;

export const warehouses = [
  { name: "Indore Main Warehouse", code: "IND-01", location: "Pithampur, MP", capacity: 18000, used: 12420, cover: 21, status: "Healthy" },
  { name: "Dewas Warehouse", code: "DEW-02", location: "Dewas, MP", capacity: 12500, used: 10500, cover: 12, status: "Watch" },
  { name: "Bhopal Distribution Centre", code: "BHO-03", location: "Mandideep, MP", capacity: 9000, used: 4860, cover: 28, status: "Healthy" },
] as const;

export const salespeople = [
  { name: "Ravi Kumar", territory: "Indore + Dewas", day: 184200, week: 842630, month: 2842600, orders: 32 },
  { name: "Amit Sharma", territory: "Bhopal + Sehore", day: 152840, week: 794280, month: 2562140, orders: 27 },
  { name: "Sandeep Verma", territory: "Ujjain + Dhar", day: 121560, week: 688410, month: 2478930, orders: 21 },
  { name: "Neha Joshi", territory: "Mhow + Rau", day: 98420, week: 598140, month: 2086440, orders: 18 },
  { name: "Karan Singh", territory: "Ratlam + Neemuch", day: 86760, week: 554820, month: 1892120, orders: 16 },
] as const;

export const orders = [
  { id: "GGN-1048", retailer: "Gupta Traders", salesperson: "Ravi Kumar", value: 48920, items: 24, status: "Inventory review", age: "12 min ago" },
  { id: "GGN-1051", retailer: "Mahesh Stores", salesperson: "Amit Sharma", value: 38450, items: 18, status: "Ready to pick", age: "24 min ago" },
  { id: "GGN-1058", retailer: "Sharma Kirana", salesperson: "Sandeep Verma", value: 31280, items: 12, status: "Packed", age: "41 min ago" },
  { id: "GGN-1061", retailer: "New Raj Stores", salesperson: "Ravi Kumar", value: 27600, items: 9, status: "Payment review", age: "1 hr ago" },
  { id: "GGN-1064", retailer: "Patel General Store", salesperson: "Neha Joshi", value: 22840, items: 15, status: "Out for delivery", age: "2 hr ago" },
] as const;

export const finance = [
  { retailer: "Gupta Traders", invoice: "GGN-INV-01842", due: "14 Sep 2026", amount: 212800, status: "Due soon" },
  { retailer: "New Raj Stores", invoice: "GGN-INV-01837", due: "08 Sep 2026", amount: 92400, status: "Overdue" },
  { retailer: "Mahesh Stores", invoice: "GGN-INV-01831", due: "18 Sep 2026", amount: 68400, status: "On track" },
  { retailer: "Sharma Kirana", invoice: "GGN-INV-01826", due: "22 Sep 2026", amount: 38600, status: "On track" },
] as const;

export const dispatch = [
  { run: "RUN-018", warehouse: "Indore Main Warehouse", driver: "Vikram Rao", stops: 8, status: "Loaded", eta: "Today · 16:20" },
  { run: "RUN-019", warehouse: "Dewas Warehouse", driver: "Mohan Patel", stops: 6, status: "Picking", eta: "Today · 18:10" },
  { run: "RUN-020", warehouse: "Bhopal Distribution Centre", driver: "Aakash Jain", stops: 5, status: "Planned", eta: "Tomorrow · 10:00" },
] as const;

export const sap = [
  { object: "Material master", lastSync: "Today · 10:42", records: "1,284", status: "Ready" },
  { object: "Business partners", lastSync: "Today · 10:40", records: "482", status: "Ready" },
  { object: "Sales orders", lastSync: "Today · 10:38", records: "5,192", status: "Ready" },
  { object: "Inventory snapshots", lastSync: "Today · 10:35", records: "3 warehouses", status: "Watch" },
] as const;

export const categories = [
  ["Daal", "5 categories", "148 SKUs", "#d9a441"],
  ["Rice", "2 categories", "42 SKUs", "#b86b45"],
  ["Atta", "1 category", "18 SKUs", "#9b5b39"],
  ["Sugar", "1 category", "12 SKUs", "#b94b4b"],
] as const;

export function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
