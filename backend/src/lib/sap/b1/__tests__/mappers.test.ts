import { describe, expect, it } from "vitest";
import { mapOrderToB1SalesOrderDto, mapProductToB1ItemReference, mapRetailerToB1BusinessPartnerReference } from "../mappers";
import { parseBusinessPartnerResponse, parseItemResponse, parseOrderResponse } from "../parsers";

const fields = {
  businessPartnerCardCode: "CardCode",
  itemCode: "ItemCode",
  orderDocEntry: "DocEntry",
  orderDocNum: "DocNum",
  orderExternalReference: "U_GaganReference",
};

describe("SAP B1 pure mappings and parsers", () => {
  it("maps retailer and product references only through configured fields", () => {
    expect(mapRetailerToB1BusinessPartnerReference({ sapCustomerId: "CUST-1" }, fields)).toEqual({ cardCode: "CUST-1" });
    expect(mapProductToB1ItemReference({ sapMaterialId: "ITEM-1" }, fields)).toEqual({ itemCode: "ITEM-1" });
  });

  it("maps an order DTO without assuming mandatory SAP fields", () => {
    const dto = mapOrderToB1SalesOrderDto(
      { id: "order-1", orderNo: 7, externalReference: "GGN-00000007", retailerSapCustomerId: "CUST-1", items: [{ sapMaterialId: "ITEM-1", quantityCases: 2, unitPrice: 10 }] },
      { customerField: "CardCode", externalReferenceField: "U_GaganReference", itemField: "ItemCode", quantityField: "Quantity", unitPriceField: "UnitPrice" }
    );
    expect(dto).toEqual({ header: { CardCode: "CUST-1", U_GaganReference: "GGN-00000007" }, lines: [{ ItemCode: "ITEM-1", Quantity: 2, UnitPrice: 10 }] });
  });

  it("parses Business Partner, Item and Order responses with explicit mappings", () => {
    expect(parseBusinessPartnerResponse({ value: [{ CardCode: "CUST-1", CardName: "Shop" }] }, fields)).toEqual({ cardCode: "CUST-1", raw: { CardCode: "CUST-1", CardName: "Shop" } });
    expect(parseItemResponse({ value: [{ ItemCode: "ITEM-1", ItemName: "Rice" }] }, fields)).toEqual({ itemCode: "ITEM-1", raw: { ItemCode: "ITEM-1", ItemName: "Rice" } });
    expect(parseOrderResponse({ DocEntry: 44, DocNum: 1044, U_GaganReference: "GGN-00000007" }, fields)).toEqual({ docEntry: 44, docNum: 1044, externalReference: "GGN-00000007", raw: { DocEntry: 44, DocNum: 1044, U_GaganReference: "GGN-00000007" } });
  });

  it("rejects a response missing a configured identity field", () => {
    expect(() => parseOrderResponse({ DocEntry: 44 }, fields)).toThrow("DocNum");
  });
});
