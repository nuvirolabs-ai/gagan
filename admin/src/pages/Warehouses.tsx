import Dashboard from "./Dashboard";

// SAP is the system of record. This route intentionally reuses the read-only
// warehouse pulse so leaders see the same imported state as the overview.
export default function Warehouses() {
  return <Dashboard />;
}
