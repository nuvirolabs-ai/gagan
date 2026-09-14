import { describe, expect, it, vi } from "vitest";
import { cartStorageKey, createAccountCartStorage } from "../accountCartStorage";

const line = { variantId: "sku", productName: "Test", packSize: "1kg × 30", unitPrice: 3000, qty: 1 };
function fixture() {
  const records = new Map<string, string>();
  const storage = { getItem: vi.fn(async (key: string) => records.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { records.set(key, value); }) };
  return { records, storage, carts: createAccountCartStorage(storage) };
}
describe("account-owned retailer cart", () => {
  it("account B cannot load A's cart; returning to A and restarting restores it", async () => {
    const { carts, storage } = fixture();
    await carts.save("A", [line]);
    expect(await carts.load("B")).toEqual([]);
    await carts.save("B", [{ ...line, qty: 2 }]);
    expect(await createAccountCartStorage(storage).load("A")).toEqual([line]);
    expect(await carts.load("B")).toEqual([{ ...line, qty: 2 }]);
  });
  it("does not adopt or erase the legacy unowned cart", async () => {
    const { records, carts } = fixture();
    records.set("gagan_cart_v1", JSON.stringify([line]));
    expect(await carts.load("A")).toEqual([]);
    expect(records.get("gagan_cart_v1")).toBe(JSON.stringify([line]));
  });
  it("serializes concurrent saves so the older write cannot finish last", async () => {
    const { carts, storage, records } = fixture();
    let release!: () => void;
    storage.setItem.mockImplementationOnce(async (key, value) => {
      await new Promise<void>(resolve => { release = resolve; });
      records.set(key, value);
    });
    const first = carts.save("A", [line]);
    const second = carts.save("A", [{ ...line, qty: 2 }]);
    await vi.waitFor(() => expect(storage.setItem).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);
    expect((await carts.load("A"))[0].qty).toBe(2);
  });
  it("reports write failure and allows a later explicit retry", async () => {
    const { carts, storage } = fixture();
    storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    await expect(carts.save("A", [line])).rejects.toThrow("disk full");
    await carts.save("A", [line]);
    expect(await carts.load("A")).toEqual([line]);
  });
  it.each(["bad json", JSON.stringify({ version: 2, accountId: "B", lines: [line] }),
    JSON.stringify({ version: 2, accountId: "A", lines: [{ ...line, qty: -1 }] })])("retains unreadable/mismatched data without treating it as an empty cart", async raw => {
    const { carts, records, storage } = fixture();
    records.set(cartStorageKey("A"), raw);
    await expect(carts.load("A")).rejects.toThrow();
    expect(records.get(cartStorageKey("A"))).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("propagates storage read errors", async () => {
    const { carts, storage } = fixture();
    storage.getItem.mockRejectedValueOnce(new Error("unavailable"));
    await expect(carts.load("A")).rejects.toThrow("unavailable");
  });
});
