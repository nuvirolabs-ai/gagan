import type {
  SapB1BusinessPartnerReference,
  SapB1FieldMappings,
  SapB1ItemReference,
  SapB1OrderMapping,
  SapB1SalesOrderDto,
} from "./types";

export interface GaganRetailerReference {
  sapCustomerId: string | null | undefined;
}

export interface GaganProductReference {
  sapMaterialId: string | null | undefined;
}

export interface GaganOrderReference {
  id: string;
  orderNo: number;
  externalReference: string;
  retailerSapCustomerId: string;
  items: Array<{ sapMaterialId: string; quantityCases: number; unitPrice: number; warehouseCode?: string }>;
}

function required(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`${label} is not mapped to SAP B1`);
  return value;
}

export function mapRetailerToB1BusinessPartnerReference(
  retailer: GaganRetailerReference,
  _mappings: SapB1FieldMappings
): SapB1BusinessPartnerReference {
  return { cardCode: required(retailer.sapCustomerId, "Retailer CardCode") };
}

export function mapProductToB1ItemReference(
  product: GaganProductReference,
  _mappings: SapB1FieldMappings
): SapB1ItemReference {
  return { itemCode: required(product.sapMaterialId, "Product ItemCode") };
}

export function mapOrderToB1SalesOrderDto(order: GaganOrderReference, mappings: SapB1OrderMapping): SapB1SalesOrderDto {
  const header = {
    ...(mappings.customerField ? { [mappings.customerField]: required(order.retailerSapCustomerId, "Order CardCode") } : {}),
    ...(mappings.externalReferenceField ? { [mappings.externalReferenceField]: order.externalReference } : {}),
  };
  const lines = order.items.map((item) => ({
    ...(mappings.itemField ? { [mappings.itemField]: required(item.sapMaterialId, "Order ItemCode") } : {}),
    ...(mappings.quantityField ? { [mappings.quantityField]: item.quantityCases } : {}),
    ...(mappings.unitPriceField ? { [mappings.unitPriceField]: item.unitPrice } : {}),
    ...(mappings.warehouseField && item.warehouseCode ? { [mappings.warehouseField]: item.warehouseCode } : {}),
  }));
  return { header, lines };
}
