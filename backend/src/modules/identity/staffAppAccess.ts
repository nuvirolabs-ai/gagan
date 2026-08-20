import { Permissions } from "./roleCatalog";

export function staffAppAccess(permissions: string[], salesRepId: string | null) {
  return {
    canEnterApp: true,
    canUseSalesWorkspace:
      permissions.includes(Permissions.ORDER_CREATE_FOR_RETAILER) && Boolean(salesRepId),
  };
}
