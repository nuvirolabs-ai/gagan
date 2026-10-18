export const MSG91_CONFIG = {
  widgetId: "366a7265766a313133313832",
  tokenAuth: "582611TbIk02hM6ad4580bP1",
  urls: [
    "https://verify.msg91.com/otp-provider.js",
    "https://verify.phone91.com/otp-provider.js",
  ],
};

export function extractMsg91Token(data: unknown): string | null {
  if (typeof data === "string") return data.trim();
  if (data && typeof data === "object") {
    const record = data as Record<string, any>;
    if (typeof record["access-token"] === "string") return record["access-token"];
    if (typeof record.accessToken === "string") return record.accessToken;
    if (typeof record.token === "string") return record.token;
    if (typeof record.message === "string" && record.message.startsWith("ey")) return record.message;
    if (record.data && typeof record.data === "object") {
      const inner = record.data;
      if (typeof inner["access-token"] === "string") return inner["access-token"];
      if (typeof inner.accessToken === "string") return inner.accessToken;
      if (typeof inner.token === "string") return inner.token;
    }
  }
  return null;
}
