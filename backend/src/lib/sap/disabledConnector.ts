import {
  SapConnector,
  SapCustomer,
  SapMaterial,
  SapPrice,
  SapStock,
  SapSalesOrderPayload,
  SapSalesOrderResult,
  SapInvoicePayload,
  SapInvoiceResult,
  SapDeliveryNotePayload,
  SapDeliveryNoteResult,
  SapFinancialSummary,
} from "./connector";

/**
 * The default until SAP access is confirmed. The app runs entirely on its own
 * tables (spec §7: "until SAP access is confirmed, the app runs with its own
 * Retailer, Product, PriceList tables as the working source of truth").
 *
 * Pulls return nothing. Pushes throw, so an order can never be silently marked
 * as posted to a SAP that isn't there — the outbox keeps it queued instead.
 */
export class DisabledSapConnector implements SapConnector {
  readonly name = "disabled";
  readonly enabled = false;

  async login(): Promise<void> { throw new Error("SAP integration is not configured (SAP_MODE=disabled)"); }
  async logout(): Promise<void> {}

  async fetchCustomers(): Promise<SapCustomer[]> {
    return [];
  }
  async fetchMaterials(): Promise<SapMaterial[]> {
    return [];
  }
  async fetchPricing(): Promise<SapPrice[]> {
    return [];
  }
  async fetchStock(): Promise<SapStock[]> {
    return [];
  }
  async fetchInvoices(): Promise<SapInvoicePayload[]> { return []; }
  async fetchFinancialSummary(_sapCustomerId: string): Promise<SapFinancialSummary | null> { return null; }

  async postSalesOrder(_payload: SapSalesOrderPayload): Promise<SapSalesOrderResult> {
    throw new Error("SAP integration is not configured (SAP_MODE=disabled)");
  }
  async findSalesOrderByExternalReference(_externalReference: string): Promise<SapSalesOrderResult | null> {
    return null;
  }
  async postInvoice(_payload: SapInvoicePayload): Promise<SapInvoiceResult> {
    throw new Error("SAP integration is not configured (SAP_MODE=disabled)");
  }
  async postDeliveryNote(_payload: SapDeliveryNotePayload): Promise<SapDeliveryNoteResult> {
    throw new Error("SAP integration is not configured (SAP_MODE=disabled)");
  }
}
