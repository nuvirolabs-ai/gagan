export const StaffPermissions = {
  ORDER_CREATE_FOR_RETAILER: "order.create_for_retailer",
  COLLECTION_SUBMIT: "collection.submit",
  APPROVAL_SECOND_INVOICE: "approval.second_invoice",
  APPROVAL_THIRD_INVOICE: "approval.third_invoice",
  COLLECTION_CONFIRM: "collection.confirm",
  CREDIT_RATING_CONFIRM: "credit.rating_confirm",
  LEGAL_DECIDE: "legal.decide",
} as const;

export function staffCapabilities(permissions: string[]) {
  const granted = new Set(permissions);
  return {
    canOrderForRetailers: granted.has(StaffPermissions.ORDER_CREATE_FOR_RETAILER),
    canCollect: granted.has(StaffPermissions.COLLECTION_SUBMIT),
    canApprove: [
      StaffPermissions.APPROVAL_SECOND_INVOICE,
      StaffPermissions.APPROVAL_THIRD_INVOICE,
      StaffPermissions.COLLECTION_CONFIRM,
      StaffPermissions.LEGAL_DECIDE,
    ].some((permission) => granted.has(permission)),
    canReviewRatings: granted.has(StaffPermissions.CREDIT_RATING_CONFIRM),
  };
}
