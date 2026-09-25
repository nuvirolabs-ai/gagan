import { Navigate } from "react-router-dom";

/** Warehouse master data lives in SAP. This route used to show demo stock. */
export default function Warehouses() {
  return <Navigate to="/sap" replace />;
}
