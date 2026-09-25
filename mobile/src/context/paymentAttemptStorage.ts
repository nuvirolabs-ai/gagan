export interface PaymentAttemptPayload {
  amountCents: number;
  invoiceScopeId: string | null;
  jainCents: number | null;
  padamCents: number | null;
}

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface SavedAttempt {
  version: 1;
  retailerId: string;
  fingerprint: string;
  key: string;
}

function storageKey(retailerId: string): string {
  if (!retailerId.trim()) throw new Error("Payment retailer required");
  return `gagan_payment_attempt_v1:${encodeURIComponent(retailerId)}`;
}

function fingerprint(payload: PaymentAttemptPayload): string {
  return JSON.stringify({
    amountCents: payload.amountCents,
    invoiceScopeId: payload.invoiceScopeId,
    jainCents: payload.jainCents,
    padamCents: payload.padamCents,
  });
}

function newKey(): string {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createPaymentAttemptStorage(storage: Storage, createKey = newKey) {
  const pending = new Map<string, Promise<unknown>>();
  const enqueue = <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const result = (pending.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);
    pending.set(key, result);
    void result.finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    }).catch(() => {});
    return result;
  };

  return {
    getOrCreate(retailerId: string, payload: PaymentAttemptPayload): Promise<string> {
      const key = storageKey(retailerId);
      const requestFingerprint = fingerprint(payload);
      return enqueue(key, async () => {
        const raw = await storage.getItem(key);
        if (raw) {
          let saved: SavedAttempt;
          try {
            saved = JSON.parse(raw);
          } catch {
            throw new Error("Saved payment attempt could not be verified");
          }
          if (
            saved?.version !== 1 || saved.retailerId !== retailerId ||
            typeof saved.fingerprint !== "string" || typeof saved.key !== "string" || !saved.key
          ) {
            throw new Error("Saved payment attempt could not be verified");
          }
          if (saved.fingerprint === requestFingerprint) return saved.key;
        }

        const next = { version: 1 as const, retailerId, fingerprint: requestFingerprint, key: createKey() };
        await storage.setItem(key, JSON.stringify(next));
        return next.key;
      });
    },
    clear(retailerId: string): Promise<void> {
      const key = storageKey(retailerId);
      return enqueue(key, () => storage.removeItem(key));
    },
  };
}
