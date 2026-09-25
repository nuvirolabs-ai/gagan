import { Permissions } from "./roleCatalog";
import { normalizeIndianPhone } from "./otpService";

export type StaffWorkspaceMode =
  | "sales"
  | "sales_leader"
  | "manager_only"
  | "setup_required"
  | "access_only";

export interface StaffWorkspaceIdentity {
  status: string;
  roles: string[];
  permissions: string[];
  staffPhone: string;
  salesRepId: string | null;
  salesRepPhone: string | null;
}

export function staffWorkspaceState(identity: StaffWorkspaceIdentity): {
  canEnterApp: boolean;
  canUseSalesWorkspace: boolean;
  workspaceMode: StaffWorkspaceMode;
  setupCode: string | null;
} {
  if (identity.status !== "active") {
    return { canEnterApp: false, canUseSalesWorkspace: false, workspaceMode: "access_only", setupCode: null };
  }
  const salesperson = identity.roles.includes("salesperson");
  const manager = identity.roles.includes("field_manager");
  if (!salesperson && !manager) {
    return { canEnterApp: true, canUseSalesWorkspace: false, workspaceMode: "access_only", setupCode: null };
  }
  if (salesperson) {
    let matchingPhone = false;
    try {
      matchingPhone = Boolean(identity.salesRepPhone) &&
        normalizeIndianPhone(identity.staffPhone) === normalizeIndianPhone(identity.salesRepPhone!);
    } catch {
      matchingPhone = false;
    }
    if (!identity.salesRepId || !matchingPhone) {
      return { canEnterApp: true, canUseSalesWorkspace: false, workspaceMode: "setup_required", setupCode: "sales_rep_link_invalid" };
    }
    if (![
      Permissions.ORDER_CREATE_FOR_RETAILER,
      Permissions.ROUTE_EXECUTE,
      Permissions.ATTENDANCE_MANAGE_SELF,
    ].every((permission) => identity.permissions.includes(permission)) ||
        (manager && !identity.permissions.includes(Permissions.PERFORMANCE_VIEW_TEAM))) {
      return { canEnterApp: true, canUseSalesWorkspace: false, workspaceMode: "setup_required", setupCode: "role_permission_mismatch" };
    }
    return { canEnterApp: true, canUseSalesWorkspace: true, workspaceMode: manager ? "sales_leader" : "sales", setupCode: null };
  }
  if (!identity.permissions.includes(Permissions.PERFORMANCE_VIEW_TEAM)) {
    return { canEnterApp: true, canUseSalesWorkspace: false, workspaceMode: "setup_required", setupCode: "role_permission_mismatch" };
  }
  return { canEnterApp: true, canUseSalesWorkspace: false, workspaceMode: "manager_only", setupCode: null };
}

export function staffAppAccess(permissions: string[], salesRepId: string | null) {
  return {
    canEnterApp: true,
    canUseSalesWorkspace:
      permissions.includes(Permissions.ORDER_CREATE_FOR_RETAILER) && Boolean(salesRepId),
  };
}
