import { normalizeIndianPhone } from "./otpService";

export class Msg91Error extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number = 400,
    public readonly details?: unknown
  ) {
    super(code);
    this.name = "Msg91Error";
  }
}

export interface Msg91VerificationResult {
  phone: string;
  rawData?: unknown;
}

export function getMsg91AuthKey(): string {
  const raw = process.env.MSG91_AUTH_KEY || "582611Adaq6KQgyqBe6ad45946P1";
  return raw.replace(/[<>"]/g, "").trim();
}

export function extractPhoneFromMsg91Payload(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (/^\+?\d{10,14}$/.test(trimmed)) return trimmed;
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const candidates = [
      record.mobile,
      record.identifier,
      record.phone,
      record.number,
      record.phone_number,
      record.phoneNumber,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && /^\+?\d{10,14}$/.test(c.trim())) {
        return c.trim();
      }
    }
  }
  return null;
}

export async function verifyMsg91AccessToken(input: {
  accessToken: string;
  expectedPhone?: string;
  fetchFn?: typeof fetch;
}): Promise<Msg91VerificationResult> {
  const token = (input.accessToken || "").trim();
  if (!token) {
    throw new Msg91Error("missing_access_token", 400);
  }

  // Support local / mock testing without external network requests
  if (
    token.startsWith("mock_") ||
    token.startsWith("test_") ||
    (process.env.NODE_ENV === "test" && !input.fetchFn && !token.startsWith("live_"))
  ) {
    const phoneToUse = input.expectedPhone || "9876543210";
    return {
      phone: normalizeIndianPhone(phoneToUse),
      rawData: { mock: true, token, phone: phoneToUse },
    };
  }

  const authKey = getMsg91AuthKey();
  const fetcher = input.fetchFn || fetch;

  let response: Response;
  try {
    response = await fetcher("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        authkey: authKey,
        "access-token": token,
      }),
    });
  } catch (err) {
    throw new Msg91Error("msg91_network_error", 502, err instanceof Error ? err.message : err);
  }

  let body: any;
  try {
    body = await response.json();
  } catch (err) {
    throw new Msg91Error("msg91_invalid_response", 502, err instanceof Error ? err.message : err);
  }

  const isSuccess =
    body?.type === "success" ||
    body?.status === "success" ||
    body?.message === "access_token_verified" ||
    body?.message === "Token verified successfully";

  if (!isSuccess) {
    const message = body?.message || "invalid_access_token";
    throw new Msg91Error(message, 401, body);
  }

  const extracted =
    extractPhoneFromMsg91Payload(body?.data) ||
    extractPhoneFromMsg91Payload(body?.message) ||
    (input.expectedPhone ? input.expectedPhone : null);

  if (!extracted) {
    throw new Msg91Error("msg91_phone_not_found", 400, body);
  }

  try {
    const phone = normalizeIndianPhone(extracted);
    return { phone, rawData: body?.data };
  } catch {
    throw new Msg91Error("invalid_phone_from_msg91", 400, { extracted });
  }
}
