/**
 * SAP boundary (spec §7).
 *
 * The spec's design principle is that the backend owns a sync layer that
 * abstracts SAP away, and nothing above it changes once the real integration
 * lands. This interface is that line. Everything above it — apps, admin, order
 * flow — talks only to our own tables.
 *
 * The two open questions (S/4HANA OData vs ECC RFC/BAPI, and real-time vs
 * batch) are answered *inside* an implementation of this interface:
 *   - transport differences stay in the connector
 *   - cadence is a scheduling decision, since every pull is expressed as
 *     "give me what changed since `since`"
 */

export interface SapCustomer {
  sapCustomerId: string;
  name: string;
  phone: string | null;
  shopAddress: string | null;
  /** SAP's own tier/price-group code; mapped to a local Tier by name. */
  priceGroup: string | null;
  creditLimit: number | null;
}

export interface SapMaterial {
  sapMaterialId: string;
  name: string;
  category: string | null;
  unitSize: string | null;
  unit: string | null;
  unitsPerCase: number | null;
  unitWeightKg: number | null;
}

export interface SapPrice {
  sapMaterialId: string;
  /** SAP price group; resolved to a local Tier. */
  priceGroup: string;
  /** Price of one case, matching how PriceList stores it. */
  price: number;
}

export interface SapStock {
  sapMaterialId: string;
  availableQty: number;
}

export interface SapSalesOrderResult {
  sapSalesOrderId: string;
}

export interface SapInvoiceResult {
  sapInvoiceId: string;
}

/** One order, flattened to what SAP SD needs to post a sales order. */
export interface SapSalesOrderPayload {
  orderId: string;
  orderNo: number;
  sapCustomerId: string;
  placedAt: string;
  lines: {
    sapMaterialId: string;
    quantityCases: number;
    unitPrice: number;
  }[];
}

/** A delivered-weight invoice, for posting back into SAP FI/SD. */
export interface SapInvoicePayload {
  ledgerEntryId: string;
  orderId: string;
  sapCustomerId: string;
  amount: number;
  invoicedAt: string;
  lines: {
    sapMaterialId: string;
    billedWeightKg: number | null;
    billedCases: number | null;
    lineTotal: number;
  }[];
}

export interface SapConnector {
  readonly name: string;
  /** False when no SAP is wired up; callers skip sync entirely. */
  readonly enabled: boolean;

  fetchCustomers(since: Date | null): Promise<SapCustomer[]>;
  fetchMaterials(since: Date | null): Promise<SapMaterial[]>;
  fetchPricing(since: Date | null): Promise<SapPrice[]>;
  fetchStock(since: Date | null): Promise<SapStock[]>;

  postSalesOrder(payload: SapSalesOrderPayload): Promise<SapSalesOrderResult>;
  /** Find a previously accepted order by the stable external Gagan order id. */
  findSalesOrderByExternalReference(externalReference: string): Promise<SapSalesOrderResult | null>;
  postInvoice(payload: SapInvoicePayload): Promise<SapInvoiceResult>;
}
