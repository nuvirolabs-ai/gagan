import { describe, expect, it, vi } from "vitest";
import { SapB1ServiceLayerConnector } from "../../serviceLayerConnector";
import { SapB1ReconciliationError } from "../errors";
import { SapB1HttpClient } from "../httpClient";

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("SapB1ServiceLayerConnector", () => {
  it("does not call a real server when endpoint details are not supplied", async () => {
    const connector = new SapB1ServiceLayerConnector({
      config: {
        baseUrl: "https://sap.example.invalid",
        companyDb: "opaque-company-db",
        authMode: "opaque-auth-mode",
        username: "opaque-user",
        password: "opaque-password",
        defaultWarehouse: "opaque-warehouse",
      },
    });
    await expect(connector.fetchCustomers(null)).rejects.toMatchObject({ code: "sap_b1_endpoint_not_configured" });
  });

  it("exposes a typed reconciliation miss for callers to handle", () => {
    const error = new SapB1ReconciliationError("corr-1", "GGN-00000001");
    expect(error).toMatchObject({ kind: "reconciliation", correlationId: "corr-1", externalReference: "GGN-00000001" });
  });

  it("captures DocEntry and DocNum from a mocked order response", async () => {
    const client = new SapB1HttpClient({
      baseUrl: "https://sap.example.invalid",
      fetchImpl: vi.fn().mockResolvedValue(response({ DocEntry: 88, DocNum: 1088 })),
    });
    const connector = new SapB1ServiceLayerConnector({
      config: {
        baseUrl: "https://sap.example.invalid",
        companyDb: "opaque-company-db",
        authMode: "opaque-auth-mode",
        username: "opaque-user",
        password: "opaque-password",
        defaultWarehouse: "opaque-warehouse",
      },
      client,
      endpoints: { orders: "/opaque-orders" },
      fields: { businessPartnerCardCode: "CardCode", itemCode: "ItemCode", orderDocEntry: "DocEntry", orderDocNum: "DocNum" },
      orderMapping: { customerField: "CardCode", itemField: "ItemCode", quantityField: "Quantity" },
    });

    await expect(connector.postSalesOrder({
      orderId: "order-1",
      orderNo: 1,
      externalReference: "GGN-00000001",
      sapCustomerId: "opaque-card-code",
      placedAt: "2026-01-01T00:00:00.000Z",
      lines: [{ sapMaterialId: "opaque-item-code", quantityCases: 1, unitPrice: 1 }],
    })).resolves.toMatchObject({ sapDocEntry: 88, sapDocNum: 1088 });
  });

  it("looks up an existing order through the injected external-reference path", async () => {
    const client = new SapB1HttpClient({
      baseUrl: "https://sap.example.invalid",
      fetchImpl: vi.fn().mockResolvedValue(response({ DocEntry: 89, DocNum: 1089 })),
    });
    const connector = new SapB1ServiceLayerConnector({
      config: { baseUrl: "https://sap.example.invalid", companyDb: "db", authMode: "mode", username: "user", password: "password", defaultWarehouse: "warehouse" },
      client,
      endpoints: { orderByExternalReference: (reference) => `/opaque-lookup?reference=${encodeURIComponent(reference)}` },
      fields: { businessPartnerCardCode: "CardCode", itemCode: "ItemCode", orderDocEntry: "DocEntry", orderDocNum: "DocNum" },
    });

    await expect(connector.findSalesOrderByExternalReference("GGN-00000001")).resolves.toMatchObject({ sapDocEntry: 89, sapDocNum: 1089 });
  });
});
