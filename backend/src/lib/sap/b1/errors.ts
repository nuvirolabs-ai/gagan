export type SapB1ErrorKind = "http" | "timeout" | "unauthorized" | "malformed_response" | "reconciliation" | "endpoint_not_configured";

export class SapB1Error extends Error {
  constructor(
    message: string,
    public readonly kind: SapB1ErrorKind,
    public readonly correlationId: string,
    options?: { status?: number; sapCode?: string; externalReference?: string }
  ) {
    super(message);
    this.name = "SapB1Error";
    Object.assign(this, options);
  }
}

export class SapB1HttpError extends SapB1Error {
  constructor(correlationId: string, status: number, sapCode?: string) {
    super("SAP B1 request failed", status === 401 ? "unauthorized" : "http", correlationId, { status, sapCode });
  }
}

export class SapB1TimeoutError extends SapB1Error {
  constructor(correlationId: string) {
    super("SAP B1 request timed out", "timeout", correlationId);
  }
}

export class SapB1MalformedResponseError extends SapB1Error {
  constructor(correlationId: string, field?: string) {
    super(`SAP B1 returned a malformed response${field ? ` for ${field}` : ""}`, "malformed_response", correlationId);
  }
}

export class SapB1ReconciliationError extends SapB1Error {
  constructor(correlationId: string, externalReference: string) {
    super("SAP B1 order could not be reconciled", "reconciliation", correlationId, { externalReference });
  }
}

export class SapB1EndpointNotConfiguredError extends SapB1Error {
  readonly code = "sap_b1_endpoint_not_configured";

  constructor(correlationId: string, operation: string) {
    super(`SAP B1 endpoint is not configured for ${operation}`, "endpoint_not_configured", correlationId);
    this.name = "SapB1EndpointNotConfiguredError";
  }
}
