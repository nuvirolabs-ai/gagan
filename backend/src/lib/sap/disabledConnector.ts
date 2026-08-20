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

  async postSalesOrder(_payload: SapSalesOrderPayload): Promise<SapSalesOrderResult> {
    throw new Error("SAP integration is not configured (SAP_MODE=disabled)");
  }
  async postInvoice(_payload: SapInvoicePayload): Promise<SapInvoiceResult> {
    throw new Error("SAP integration is not configured (SAP_MODE=disabled)");
  }
}
