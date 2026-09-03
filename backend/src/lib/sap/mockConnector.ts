import crypto from "crypto";
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
 * Fixture-backed SAP for development. It exists so the sync layer, mapping and
 * outbox can be exercised and tested before anyone answers the S/4HANA-vs-ECC
 * question — swapping in the real connector should then be a no-op above this
 * boundary.
 *
 * The fixtures intentionally mirror the seeded catalog so a sync links records
 * instead of creating duplicates.
 */
export class MockSapConnector implements SapConnector {
  readonly name = "mock";
  readonly enabled = true;
  private readonly acceptedSalesOrders = new Map<string, SapSalesOrderResult>();

  async login(): Promise<void> {}
  async logout(): Promise<void> {}

  async fetchCustomers(_since: Date | null): Promise<SapCustomer[]> {
    return [
      {
        sapCustomerId: "SAP-CUST-1001",
        name: "Mahesh Store",
        phone: "9999999999",
        shopAddress: "12 Market Road, Pune",
        priceGroup: "Gold",
        creditLimit: 100000,
      },
      // Staging-only golden-path customer. This lets the normal customer sync
      // link the disposable UAT identity before the outbox is drained; it is
      // never returned by the real Service Layer connector.
      {
        sapCustomerId: "SAP-CUST-UAT-1001",
        name: "[UAT GOLDEN PATH] Sunrise Stores",
        phone: "9812345698",
        shopAddress: "101 Demo Market Road, Pune",
        priceGroup: "Gold",
        creditLimit: 100000,
      },
    ];
  }

  async fetchMaterials(_since: Date | null): Promise<SapMaterial[]> {
    return [
      { sapMaterialId: "SAP-MAT-TOOR", name: "Gagan Toor Dal | 1 KG", category: "Daal", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 },
      { sapMaterialId: "SAP-MAT-BASM", name: "Basmati Rice", category: "Rice", unitSize: "1 kg", unit: "kg", unitsPerCase: 12, unitWeightKg: 1 },
      { sapMaterialId: "SAP-MAT-CHAN", name: "Chana Dal", category: "Daal", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 },
      { sapMaterialId: "SAP-MAT-SUGR", name: "Sugar", category: "Sugar", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 },
      { sapMaterialId: "DEMO-MAT-MOON", name: "Moong Dal", category: "Daal", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 },
      { sapMaterialId: "DEMO-MAT-SONA", name: "Sona Masoori Rice", category: "Rice", unitSize: "1 kg", unit: "kg", unitsPerCase: 25, unitWeightKg: 1 },
      { sapMaterialId: "DEMO-MAT-URAD", name: "Urad Dal", category: "Daal", unitSize: "1 kg", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 },
      { sapMaterialId: "DEMO-MAT-POHA", name: "Poha", category: "Breakfast", unitSize: "500 g", unit: "kg", unitsPerCase: 40, unitWeightKg: 0.5 },
    ];
  }

  async fetchPricing(_since: Date | null): Promise<SapPrice[]> {
    // Slightly different from the seeded prices so a sync visibly takes effect.
    return [
      { sapMaterialId: "SAP-MAT-TOOR", priceGroup: "Gold", price: 3120 },
      { sapMaterialId: "SAP-MAT-TOOR", priceGroup: "Silver", price: 3240 },
      { sapMaterialId: "SAP-MAT-BASM", priceGroup: "Gold", price: 5350 },
      { sapMaterialId: "SAP-MAT-BASM", priceGroup: "Silver", price: 5550 },
      { sapMaterialId: "SAP-MAT-CHAN", priceGroup: "Gold", price: 2850 },
      { sapMaterialId: "SAP-MAT-CHAN", priceGroup: "Silver", price: 2950 },
      { sapMaterialId: "SAP-MAT-SUGR", priceGroup: "Gold", price: 1650 },
      { sapMaterialId: "SAP-MAT-SUGR", priceGroup: "Silver", price: 1720 },
      { sapMaterialId: "DEMO-MAT-MOON", priceGroup: "Gold", price: 3400 },
      { sapMaterialId: "DEMO-MAT-MOON", priceGroup: "Silver", price: 3520 },
      { sapMaterialId: "DEMO-MAT-SONA", priceGroup: "Gold", price: 2200 },
      { sapMaterialId: "DEMO-MAT-SONA", priceGroup: "Silver", price: 2290 },
      { sapMaterialId: "DEMO-MAT-URAD", priceGroup: "Gold", price: 3600 },
      { sapMaterialId: "DEMO-MAT-URAD", priceGroup: "Silver", price: 3730 },
      { sapMaterialId: "DEMO-MAT-POHA", priceGroup: "Gold", price: 1450 },
      { sapMaterialId: "DEMO-MAT-POHA", priceGroup: "Silver", price: 1510 },
    ];
  }

  async fetchStock(_since: Date | null): Promise<SapStock[]> {
    return [
      { sapMaterialId: "SAP-MAT-TOOR", warehouseCode: "WH-001", availableQty: 420, committedQty: 0 },
      { sapMaterialId: "SAP-MAT-BASM", warehouseCode: "WH-001", availableQty: 180, committedQty: 0 },
      { sapMaterialId: "SAP-MAT-CHAN", warehouseCode: "WH-001", availableQty: 160, committedQty: 0 },
      { sapMaterialId: "SAP-MAT-SUGR", warehouseCode: "WH-001", availableQty: 240, committedQty: 0 },
      { sapMaterialId: "DEMO-MAT-MOON", warehouseCode: "WH-001", availableQty: 140, committedQty: 0 },
      { sapMaterialId: "DEMO-MAT-SONA", warehouseCode: "WH-001", availableQty: 200, committedQty: 0 },
      { sapMaterialId: "DEMO-MAT-URAD", warehouseCode: "WH-001", availableQty: 120, committedQty: 0 },
      { sapMaterialId: "DEMO-MAT-POHA", warehouseCode: "WH-001", availableQty: 220, committedQty: 0 },
    ];
  }

  async fetchInvoices(_since: Date | null): Promise<SapInvoicePayload[]> { return []; }

  async fetchFinancialSummary(_sapCustomerId: string): Promise<SapFinancialSummary | null> { return null; }

  async postSalesOrder(payload: SapSalesOrderPayload): Promise<SapSalesOrderResult> {
    if (!payload.sapCustomerId) throw new Error("Customer is not linked to SAP yet");
    const result = {
      sapSalesOrderId: `MOCK-SO-${String(payload.orderNo).padStart(6, "0")}`,
      sapDocEntry: 900000 + payload.orderNo,
      sapDocNum: 910000 + payload.orderNo,
    };
    this.acceptedSalesOrders.set(payload.externalReference, result);
    return result;
  }

  async findSalesOrderByExternalReference(externalReference: string): Promise<SapSalesOrderResult | null> {
    return this.acceptedSalesOrders.get(externalReference) ?? null;
  }

  async postInvoice(payload: SapInvoicePayload): Promise<SapInvoiceResult> {
    if (!payload.sapCustomerId) throw new Error("Customer is not linked to SAP yet");
    return { sapInvoiceId: `SAP-INV-${crypto.randomBytes(4).toString("hex").toUpperCase()}` };
  }

  async postDeliveryNote(_payload: SapDeliveryNotePayload): Promise<SapDeliveryNoteResult> {
    return { sapDeliveryNoteId: "MOCK-DN-000001" };
  }
}
