import { SapConnector } from "./connector";
import { DisabledSapConnector } from "./disabledConnector";
import { MockSapConnector } from "./mockConnector";
import { SapB1ServiceLayerConnector } from "./serviceLayerConnector";

export * from "./connector";

let cached: SapConnector | null = null;

/**
 * Chooses the connector from SAP_MODE.
 *
 * When the spec §7 questions are answered, add the implementation and a case:
 *   s4hana → OData client
 *   ecc    → RFC/BAPI client, or whatever middleware is exposed
 * Nothing outside src/lib/sap/ needs to change.
 */
export function getSapConnector(): SapConnector {
  if (cached) return cached;

  const mode = (process.env.SAP_MODE || "disabled").toLowerCase();
  switch (mode) {
    case "mock":
      cached = new MockSapConnector();
      break;
    case "disabled":
      cached = new DisabledSapConnector();
      break;
    case "service-layer":
    case "s4hana":
      cached = new SapB1ServiceLayerConnector();
      break;
    default:
      throw new Error(
        `Unknown SAP_MODE "${mode}". Implement the connector under src/lib/sap/ and register it here.`
      );
  }
  return cached;
}

/** Test seam — lets a suite swap in a fake without touching env vars. */
export function __setSapConnector(connector: SapConnector | null) {
  cached = connector;
}
