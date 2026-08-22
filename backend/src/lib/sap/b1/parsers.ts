import { SapB1MalformedResponseError } from "./errors";
import type {
  SapB1BusinessPartnerReference,
  SapB1CollectionResponse,
  SapB1FieldMappings,
  SapB1ItemReference,
  SapB1JsonRecord,
  SapB1OrderIdentity,
} from "./types";

function valueAt(record: SapB1JsonRecord, field: string, correlationId: string): unknown {
  const value = record[field];
  if (value === undefined || value === null || value === "") {
    throw new SapB1MalformedResponseError(correlationId, field);
  }
  return value;
}

function collectionFirst(response: SapB1CollectionResponse, correlationId: string): SapB1JsonRecord {
  if (!response || !Array.isArray(response.value) || !response.value[0]) {
    throw new SapB1MalformedResponseError(correlationId);
  }
  return response.value[0];
}

export function parseBusinessPartnerResponse(
  response: SapB1CollectionResponse,
  mappings: SapB1FieldMappings,
  correlationId = "unknown"
): SapB1BusinessPartnerReference {
  const raw = collectionFirst(response, correlationId);
  return { cardCode: String(valueAt(raw, mappings.businessPartnerCardCode, correlationId)), raw };
}

export function parseItemResponse(
  response: SapB1CollectionResponse,
  mappings: SapB1FieldMappings,
  correlationId = "unknown"
): SapB1ItemReference {
  const raw = collectionFirst(response, correlationId);
  return { itemCode: String(valueAt(raw, mappings.itemCode, correlationId)), raw };
}

export function parseOrderResponse(
  response: SapB1JsonRecord,
  mappings: SapB1FieldMappings,
  correlationId = "unknown"
): SapB1OrderIdentity {
  const docEntry = Number(valueAt(response, mappings.orderDocEntry, correlationId));
  const docNum = Number(valueAt(response, mappings.orderDocNum, correlationId));
  if (!Number.isFinite(docEntry) || !Number.isFinite(docNum)) {
    throw new SapB1MalformedResponseError(correlationId);
  }
  const externalReference = mappings.orderExternalReference
    ? String(valueAt(response, mappings.orderExternalReference, correlationId))
    : undefined;
  return { docEntry, docNum, ...(externalReference ? { externalReference } : {}), raw: response };
}
