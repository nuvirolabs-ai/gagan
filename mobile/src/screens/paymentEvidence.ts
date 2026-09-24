export const MAX_PAYMENT_PROOF_BYTES = 10_000_000;

export interface PickedPaymentProofImage {
  uri: string;
  base64?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface PaymentProofImage {
  uri: string;
  name: string;
  contentType: "image/jpeg";
  bodyBase64: string;
}

export function toPaymentProof(asset: PickedPaymentProofImage): PaymentProofImage {
  if (!asset.base64) throw new Error("proof_data_missing");
  const sizeBytes = asset.fileSize ?? decodedSize(asset.base64);
  if (sizeBytes > MAX_PAYMENT_PROOF_BYTES) throw new Error("proof_too_large");
  return {
    uri: asset.uri,
    name: asset.fileName || "payment-proof.jpg",
    contentType: "image/jpeg",
    bodyBase64: asset.base64,
  };
}

function decodedSize(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}
