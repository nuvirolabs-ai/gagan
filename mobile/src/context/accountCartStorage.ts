import type { CartLine } from "../types";

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function cartStorageKey(accountId: string): string {
  if (!accountId.trim()) throw new Error("Cart account required");
  return `gagan_cart_v2:${encodeURIComponent(accountId)}`;
}

function validLines(value: unknown): value is CartLine[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  return value.every(line => {
    if (!line || typeof line.variantId !== "string" || !line.variantId || seen.has(line.variantId)
      || !Number.isSafeInteger(line.qty) || line.qty <= 0 || line.qty > 2_147_483_647
      || !Number.isFinite(line.unitPrice) || line.unitPrice < 0
      || typeof line.productName !== "string" || typeof line.packSize !== "string") return false;
    seen.add(line.variantId);
    return true;
  });
}

/** One writer per account. Unowned v1 carts are retained untouched, never
 * assigned to whichever user happens to sign in next. */
export function createAccountCartStorage(storage: Storage) {
  const pending = new Map<string, Promise<void>>();
  return {
    async load(accountId: string): Promise<CartLine[]> {
      const key = cartStorageKey(accountId);
      await pending.get(key);
      const raw = await storage.getItem(key);
      if (!raw) return [];
      const saved = JSON.parse(raw);
      if (saved?.version !== 2 || saved.accountId !== accountId || !validLines(saved.lines)) {
        throw new Error("Saved cart could not be verified");
      }
      return saved.lines;
    },
    save(accountId: string, lines: CartLine[]): Promise<void> {
      const key = cartStorageKey(accountId);
      if (!validLines(lines)) return Promise.reject(new Error("Invalid cart"));
      const value = JSON.stringify({ version: 2, accountId, lines });
      const operation = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(() => storage.setItem(key, value));
      pending.set(key, operation);
      // Observe rejection without hiding it from the caller or a concurrent load.
      void operation.finally(() => { if (pending.get(key) === operation) pending.delete(key); }).catch(() => {});
      return operation;
    },
  };
}
