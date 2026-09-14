import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartLine } from "../types";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { createAccountCartStorage } from "./accountCartStorage";

const cartStorage = createAccountCartStorage(AsyncStorage);

interface CartContextValue {
  lines: CartLine[];
  hydrated: boolean;
  addLine: (line: CartLine) => void;
  updateQty: (variantId: string, qty: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
  total: number;
  /** Re-price and remove stale lines against the current server catalog. */
  reconcile: () => Promise<CartLine[]>;
  /** Set when a saved cart was adjusted on load; shown once, then dismissed. */
  staleNotice: string | null;
  dismissStaleNotice: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { retailer } = useAuth();
  const accountId = retailer?.id ?? null;
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const revision = useRef(0);
  const [cart, setCart] = useState<{ owner: string | null; lines: CartLine[]; ready: boolean }>({ owner: null, lines: [], ready: false });
  const lines = cart.owner === accountId && accountId ? cart.lines : [];
  const hydrated = cart.owner === accountId && cart.ready;
  const [staleNotice, setStaleNotice] = useState<string | null>(null);

  const reconcileSavedLines = async (saved: CartLine[]) => {
    const catalog = await api.getCatalog();
    const live = new Map<string, { price: number; productName: string; packSize: string }>();
    for (const product of catalog.catalog ?? []) {
      for (const v of product.variants ?? []) {
        const orderable = v.availability?.status === "available" && Number(v.availability.available) > 0;
        if (v.price == null || !orderable) continue;
        live.set(v.id, {
          price: Number(v.price),
          productName: product.name,
          packSize: `${v.unitSize} × ${v.unitsPerCase}`,
        });
      }
    }

    const kept: CartLine[] = [];
    let dropped = 0;
    let repriced = 0;
    for (const line of saved) {
      const current = live.get(line.variantId);
      if (!current) {
        dropped++;
        continue;
      }
      if (current.price !== line.unitPrice) repriced++;
      kept.push({
        ...line,
        unitPrice: current.price,
        productName: current.productName,
        packSize: current.packSize,
      });
    }

    let notice: string | null = null;
    if (dropped || repriced) {
      const parts: string[] = [];
      if (dropped) parts.push(`${dropped} item${dropped > 1 ? "s are" : " is"} no longer available`);
      if (repriced) parts.push(`${repriced} price${repriced > 1 ? "s" : ""} changed`);
      notice = `Your saved cart was updated: ${parts.join(", ")}.`;
    }
    return { lines: kept, notice };
  };

  /**
   * Restore the saved cart, then reconcile it against the live catalog.
   *
   * A cart can sit for days: a variant may be delisted, or its price may have
   * changed (tier move, admin edit, SAP sync). Restoring it blindly would show
   * the retailer a stale total and then fail or surprise them at checkout, so
   * vanished lines are dropped and changed prices are refreshed.
   */
  useEffect(() => {
    let cancelled = false;
    revision.current++;
    setStaleNotice(null);
    setCart({ owner: accountId, lines: [], ready: false });
    if (!accountId) return;
    (async () => {
      try {
        const saved = await cartStorage.load(accountId);
        let restored = { lines: saved, notice: null as string | null };
        if (saved.length > 0) {
          // Offline: retain this account's saved cart, then retry before order.
          try { restored = await reconcileSavedLines(saved); } catch { /* retain saved lines */ }
        }
        if (!cancelled && currentAccount.current === accountId) {
          setCart({ owner: accountId, lines: restored.lines, ready: true });
          setStaleNotice(restored.notice);
        }
      } catch {
        // Do not overwrite unreadable business data with an empty basket.
        if (!cancelled && currentAccount.current === accountId) {
          setStaleNotice("Your saved cart could not be opened. Please reopen the app to retry; saved data has been retained.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    if (!cart.ready || !cart.owner || cart.owner !== accountId) return;
    const owner = cart.owner;
    cartStorage.save(owner, cart.lines).catch(() => {
      if (currentAccount.current === owner) setStaleNotice("Cart changes could not be saved on this device. Keep the app open and try again.");
    });
  }, [cart, accountId]);

  const setLines = (update: (previous: CartLine[]) => CartLine[]) => {
    if (!accountId || !hydrated) {
      setStaleNotice("Please wait for your saved cart to load before changing items.");
      return;
    }
    revision.current++;
    setCart(previous => previous.owner === accountId && previous.ready
      ? { ...previous, lines: update(previous.lines) } : previous);
  };

  const addLine = (line: CartLine) =>
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === line.variantId ? { ...l, qty: l.qty + line.qty } : l
        );
      }
      return [...prev, line];
    });

  const updateQty = (variantId: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l))
    );

  const removeLine = (variantId: string) =>
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));

  const clear = () => setLines(() => []);

  const reconcile = async () => {
    if (!accountId || !hydrated) throw new Error("Cart is not ready");
    const version = revision.current;
    const result = await reconcileSavedLines(lines);
    if (currentAccount.current !== accountId || revision.current !== version) {
      throw new Error("Cart changed while checking prices. Please review it again.");
    }
    setCart({ owner: accountId, lines: result.lines, ready: true });
    setStaleNotice(result.notice);
    return result.lines;
  };

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  return (
    <CartContext.Provider
      value={{
        lines,
        hydrated,
        addLine,
        updateQty,
        removeLine,
        clear,
        total,
        reconcile,
        staleNotice,
        dismissStaleNotice: () => setStaleNotice(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
