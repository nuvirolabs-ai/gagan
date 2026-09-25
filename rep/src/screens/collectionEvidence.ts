export const MAX_COLLECTION_RECEIPT_BYTES = 10_000_000;

export interface PickedCollectionReceiptImage {
  uri: string;
  base64?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface CollectionReceiptImage {
  uri: string;
  name: string;
  contentType: "image/jpeg";
  bodyBase64: string;
}

export function toCollectionReceipt(asset: PickedCollectionReceiptImage): CollectionReceiptImage {
  if (!asset.base64) throw new Error("proof_data_missing");
  const sizeBytes = asset.fileSize ?? decodedSize(asset.base64);
  if (sizeBytes > MAX_COLLECTION_RECEIPT_BYTES) throw new Error("proof_too_large");
  return {
    uri: asset.uri,
    name: asset.fileName || "collection-receipt.jpg",
    contentType: "image/jpeg",
    bodyBase64: asset.base64,
  };
}

function decodedSize(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}
