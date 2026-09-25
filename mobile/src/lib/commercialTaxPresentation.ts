const GST_PENDING_MESSAGE = "GST pending — final tax will be applied before invoicing.";

export function commercialTaxPresentation(snapshot: any) {
  const pending = snapshot?.taxStatus === "PENDING" || snapshot?.gstPending === true ||
    (snapshot?.lines ?? []).some((line: any) => line.gstPending === true || line.gstPercent == null) ||
    (snapshot?.freight != null && (snapshot.freight.gstPending === true || snapshot.freight.gstPercent == null));
  return {
    pending,
    totalLabel: pending ? "Pre-tax total" : "Grand total",
    gstLabel: pending ? GST_PENDING_MESSAGE : null,
  };
}

export function isLineGstPending(line: any, snapshot: any) {
  return line?.gstPending === true || line?.gstPercent == null ||
    ((snapshot?.taxStatus === "PENDING" || snapshot?.gstPending === true) && Number(line?.gstPercent) === 0);
}

export function isFreightGstPending(freight: any, snapshot: any) {
  return freight?.gstPending === true || freight?.gstPercent == null ||
    ((snapshot?.taxStatus === "PENDING" || snapshot?.gstPending === true) && Number(freight?.gstPercent) === 0);
}
