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
import { SapB1EndpointNotConfiguredError } from "./b1/errors";
import type { SapB1Config } from "./b1/config";
import { SapB1HttpClient } from "./b1/httpClient";
import type { SapB1EndpointPaths, SapB1FieldMappings, SapB1OrderMapping } from "./b1/types";
import { mapOrderToB1SalesOrderDto } from "./b1/mappers";
import { parseOrderResponse } from "./b1/parsers";

export interface SapB1ServiceLayerConnectorOptions {
  config: SapB1Config;
  client?: SapB1HttpClient;
  endpoints?: SapB1EndpointPaths;
  fields?: SapB1FieldMappings;
  orderMapping?: SapB1OrderMapping;
  loginBody?: Record<string, unknown>;
}

/** Contract-safe B1 seam: SAP supplies all endpoint and field values at composition time. */
export class SapB1ServiceLayerConnector implements SapConnector {
  readonly name = "service-layer";
  readonly enabled = true;
  private readonly client: SapB1HttpClient;
  private readonly endpoints: SapB1EndpointPaths;

  constructor(private readonly options: SapB1ServiceLayerConnectorOptions) {
    this.client = options.client ?? new SapB1HttpClient({ baseUrl: options.config.baseUrl });
    this.endpoints = options.endpoints ?? {};
  }

  private endpoint(operation: string, path: string | undefined): string {
    if (!path) throw new SapB1EndpointNotConfiguredError("unknown", operation);
    return path;
  }

  async login(): Promise<void> {
    const path = this.endpoint("login", this.endpoints.login);
    if (!this.options.loginBody) throw new SapB1EndpointNotConfiguredError("unknown", "login payload");
    await this.client.login(path, this.options.loginBody);
  }

  async logout(): Promise<void> { this.client.sessions.clear(); }

  async fetchCustomers(_since: Date | null): Promise<SapCustomer[]> {
    this.endpoint("BusinessPartners", this.endpoints.businessPartners);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "BusinessPartners field mapping"));
  }

  async fetchMaterials(_since: Date | null): Promise<SapMaterial[]> {
    this.endpoint("Items", this.endpoints.items);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "Items field mapping"));
  }

  async fetchPricing(_since: Date | null): Promise<SapPrice[]> {
    this.endpoint("pricing", this.endpoints.pricing);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "pricing field mapping"));
  }

  async fetchStock(_since: Date | null): Promise<SapStock[]> {
    this.endpoint("inventory", this.endpoints.inventory);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "inventory field mapping"));
  }

  async fetchInvoices(_since: Date | null): Promise<SapInvoicePayload[]> {
    this.endpoint("invoices", this.endpoints.invoices);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "invoice field mapping"));
  }

  async fetchFinancialSummary(_sapCustomerId: string): Promise<SapFinancialSummary | null> {
    if (!this.endpoints.financialSummary) throw new SapB1EndpointNotConfiguredError("unknown", "financial summary");
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "financial summary field mapping"));
  }

  async postSalesOrder(payload: SapSalesOrderPayload): Promise<SapSalesOrderResult> {
    const path = this.endpoint("Orders", this.endpoints.orders);
    if (!this.options.fields || !this.options.orderMapping) throw new SapB1EndpointNotConfiguredError("unknown", "Orders field mapping");
    const dto = mapOrderToB1SalesOrderDto({
      id: payload.orderId,
      orderNo: payload.orderNo,
      externalReference: payload.externalReference,
      retailerSapCustomerId: payload.sapCustomerId,
      items: payload.lines,
    }, this.options.orderMapping);
    const raw = await this.client.request<Record<string, unknown>>("POST", path, { ...dto.header, DocumentLines: dto.lines });
    const identity = parseOrderResponse(raw, this.options.fields);
    return { sapSalesOrderId: String(identity.docEntry), sapDocEntry: identity.docEntry, sapDocNum: identity.docNum };
  }

  async findSalesOrderByExternalReference(externalReference: string): Promise<SapSalesOrderResult | null> {
    const path = this.endpoints.orderByExternalReference?.(externalReference);
    if (!path) throw new SapB1EndpointNotConfiguredError("unknown", "order lookup by external reference");
    if (!this.options.fields) throw new SapB1EndpointNotConfiguredError("unknown", "order response field mapping");
    const raw = await this.client.request<Record<string, unknown>>("GET", path);
    const identity = parseOrderResponse(raw, this.options.fields);
    return { sapSalesOrderId: String(identity.docEntry), sapDocEntry: identity.docEntry, sapDocNum: identity.docNum };
  }

  async postInvoice(_payload: SapInvoicePayload): Promise<SapInvoiceResult> {
    this.endpoint("Invoices", this.endpoints.invoices);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "Invoices field mapping"));
  }

  async postDeliveryNote(_payload: SapDeliveryNotePayload): Promise<SapDeliveryNoteResult> {
    this.endpoint("DeliveryNotes", this.endpoints.deliveryNotes);
    return Promise.reject(new SapB1EndpointNotConfiguredError("unknown", "DeliveryNotes field mapping"));
  }
}
