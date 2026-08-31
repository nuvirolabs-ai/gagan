import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartLine } from "../types";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const CART_KEY = "gagan_cart_v1";

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
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  // Avoid writing back the empty initial state before the load finishes.
  const loaded = useRef(false);

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

    setLines(kept);
    if (dropped || repriced) {
      const parts: string[] = [];
      if (dropped) parts.push(`${dropped} item${dropped > 1 ? "s are" : " is"} no longer available`);
      if (repriced) parts.push(`${repriced} price${repriced > 1 ? "s" : ""} changed`);
      setStaleNotice(`Your saved cart was updated: ${parts.join(", ")}.`);
    } else {
      setStaleNotice(null);
    }
    return kept;
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

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_KEY);
        const saved: CartLine[] = raw ? JSON.parse(raw) : [];
        if (saved.length > 0) {
          if (!retailer) {
            // Keep the saved cart while signed out. Once authentication is
            // restored, this effect runs again and reconciles against live IDs.
            if (!cancelled) setLines(saved);
          } else {
            try {
              await reconcileSavedLines(saved);
            } catch {
              // Offline or temporarily unavailable — keep the cart as saved.
              // Checkout will retry reconciliation before posting the order.
              if (!cancelled) setLines(saved);
            }
          }
        }
      } catch {
        // A corrupt cart must not block the app.
        if (!cancelled) {
          await AsyncStorage.removeItem(CART_KEY).catch(() => {});
          setLines([]);
        }
      } finally {
        if (!cancelled) {
          loaded.current = true;
          setHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retailer?.id]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(CART_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines]);

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

  const clear = () => setLines([]);

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
        reconcile: () => reconcileSavedLines(lines),
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
