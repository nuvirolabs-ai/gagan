import type {
  SapConnector,
  SapCustomer,
  SapDeliveryNotePayload,
  SapDeliveryNoteResult,
  SapFinancialSummary,
  SapInvoicePayload,
  SapInvoiceResult,
  SapMaterial,
  SapPrice,
  SapSalesOrderPayload,
  SapSalesOrderResult,
  SapStock,
} from "./connector";

/** Deliberate placeholder: real B1 credentials and endpoint contract are not supplied yet. */
export class SapB1ServiceLayerConnector implements SapConnector {
  readonly name = "service-layer-unimplemented";
  readonly enabled = true;

  private unsupported(): never {
    throw new Error("SAP B1 Service Layer connector is not configured for this environment");
  }

  login(): Promise<void> { return Promise.reject(new Error("SAP B1 Service Layer connector is not implemented")); }
  logout(): Promise<void> { return Promise.resolve(); }
  fetchCustomers(_since: Date | null): Promise<SapCustomer[]> { return this.unsupported(); }
  fetchMaterials(_since: Date | null): Promise<SapMaterial[]> { return this.unsupported(); }
  fetchPricing(_since: Date | null): Promise<SapPrice[]> { return this.unsupported(); }
  fetchStock(_since: Date | null): Promise<SapStock[]> { return this.unsupported(); }
  fetchInvoices(_since: Date | null): Promise<SapInvoicePayload[]> { return this.unsupported(); }
  fetchFinancialSummary(_sapCustomerId: string): Promise<SapFinancialSummary | null> { return this.unsupported(); }
  postSalesOrder(_payload: SapSalesOrderPayload): Promise<SapSalesOrderResult> { return this.unsupported(); }
  findSalesOrderByExternalReference(_externalReference: string): Promise<SapSalesOrderResult | null> { return this.unsupported(); }
  postInvoice(_payload: SapInvoicePayload): Promise<SapInvoiceResult> { return this.unsupported(); }
  postDeliveryNote(_payload: SapDeliveryNotePayload): Promise<SapDeliveryNoteResult> { return this.unsupported(); }
}
