import { describe, expect, it } from "vitest";
import { safeIntegrationError } from "../safeError";

describe("safe integration errors", () => {
  it("does not expose technical error details", () => {
    const response = safeIntegrationError("request-123", "sap_sync_failed");
    expect(response).toEqual({
      error: "sap_sync_failed",
      message: "The integration request could not be completed. Please retry or contact support.",
      requestId: "request-123",
    });
    expect(JSON.stringify(response)).not.toContain("b1s");
  });
});
