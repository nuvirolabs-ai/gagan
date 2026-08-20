export const StaffPermissions = {
  ORDER_CREATE_FOR_RETAILER: "order.create_for_retailer",
  COLLECTION_SUBMIT: "collection.submit",
} as const;

export function staffCapabilities(permissions: string[]) {
  const granted = new Set(permissions);
  return {
    canOrderForRetailers: granted.has(StaffPermissions.ORDER_CREATE_FOR_RETAILER),
    canCollect: granted.has(StaffPermissions.COLLECTION_SUBMIT),
  };
}
