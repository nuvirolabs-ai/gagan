export type SapB1JsonRecord = Record<string, unknown>;

export interface SapB1CollectionResponse<T extends SapB1JsonRecord = SapB1JsonRecord> {
  value: T[];
}

export interface SapB1AuthenticationRequest {
  companyDb: string;
  username: string;
  password: string;
  authMode: string;
}

export interface SapB1AuthenticationResponse {
  raw: SapB1JsonRecord;
  sessionCookie: string | null;
}

export interface SapB1BusinessPartnerRecord extends SapB1JsonRecord {}
export interface SapB1ItemRecord extends SapB1JsonRecord {}
export interface SapB1PricingRecord extends SapB1JsonRecord {}
export interface SapB1InventoryRecord extends SapB1JsonRecord {}
export interface SapB1SalesOrderRecord extends SapB1JsonRecord {}
export interface SapB1DeliveryNoteRecord extends SapB1JsonRecord {}
export interface SapB1InvoiceRecord extends SapB1JsonRecord {}
export interface SapB1FinancialSummaryRecord extends SapB1JsonRecord {}

export interface SapB1BusinessPartnerReference {
  cardCode: string;
  raw?: SapB1JsonRecord;
}

export interface SapB1ItemReference {
  itemCode: string;
  raw?: SapB1JsonRecord;
}

export interface SapB1OrderIdentity {
  docEntry: number;
  docNum: number;
  externalReference?: string;
  raw: SapB1JsonRecord;
}

export interface SapB1SalesOrderDto {
  header: SapB1JsonRecord;
  lines: SapB1JsonRecord[];
}

export interface SapB1FieldMappings {
  businessPartnerCardCode: string;
  itemCode: string;
  orderDocEntry: string;
  orderDocNum: string;
  orderExternalReference?: string;
}

export interface SapB1OrderMapping {
  customerField?: string;
  externalReferenceField?: string;
  itemField?: string;
  quantityField?: string;
  unitPriceField?: string;
  warehouseField?: string;
}

export interface SapB1EndpointPaths {
  login?: string;
  businessPartners?: string;
  items?: string;
  pricing?: string;
  inventory?: string;
  orders?: string;
  orderByExternalReference?: (externalReference: string) => string;
  deliveryNotes?: string;
  invoices?: string;
  financialSummary?: (customerReference: string) => string;
}
