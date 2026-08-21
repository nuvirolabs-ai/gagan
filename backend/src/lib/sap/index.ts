import { SapConnector } from "./connector";
import { DisabledSapConnector } from "./disabledConnector";
import { MockSapConnector } from "./mockConnector";
import { SapB1ServiceLayerConnector } from "./serviceLayerConnector";
import { parseSapB1Config } from "./b1/config";

export * from "./connector";
export * from "./b1/config";
export * from "./b1/errors";
export * from "./b1/types";

let cached: SapConnector | null = null;

/**
 * Chooses the connector from SAP_MODE.
 *
 * `service-layer` is intentionally configuration-gated. No endpoint or field
 * defaults are supplied until the SAP team signs off the B1 contract.
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
      cached = new SapB1ServiceLayerConnector({ config: parseSapB1Config(process.env) });
      break;
    case "s4hana":
      throw new Error("SAP_MODE=s4hana is not configured; use service-layer only after the SAP B1 contract is supplied");
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
