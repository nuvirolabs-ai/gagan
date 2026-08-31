import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { repApi, ApiError } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { colors, radius, spacing, shadow, inr } from "../theme";
import ProductThumb from "../components/ProductThumb";
import { SearchBar, ChipRow, QtyStepper, EmptyState } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

const ALL = "All";

export default function RepCatalogScreen({ route, navigation }: any) {
  const { retailerId, retailerName } = route.params;
  const { lines, addLine, updateQty, clearCart, cartTotal } = useRep();
  const { t } = useLanguage();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const checkoutKey = useRef<string | null>(null);

  useEffect(() => {
    repApi
      .catalogFor(retailerId)
      .then((res) => {
        setProducts(res.catalog);
        setCategories(res.categories ?? []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [retailerId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => category === ALL || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .flatMap((p) => p.variants.map((v: any) => ({ product: p, variant: v })));
  }, [products, category, query]);

  const qtyFor = (variantId: string) => lines.find((l) => l.variantId === variantId)?.qty ?? 0;

  const setQty = (product: any, variant: any, next: number) => {
    if (variant.price == null) return;
    const current = qtyFor(variant.id);
    const orderable = variant.availability?.status === "available" && Number(variant.availability.available) > 0;
    // The API owns inventory. A rep can reduce a saved line, but cannot add
    // stock that SAP has marked unavailable or stale.
    if (next > current && !orderable) return;
    if (current === 0 && next > 0) {
      addLine({
        variantId: variant.id,
        productName: product.name,
        packSize: `${variant.unitSize} × ${variant.unitsPerCase}`,
        unitPrice: Number(variant.price),
        qty: next,
      });
    } else {
      updateQty(variant.id, next);
    }
  };

  const submit = useCallback(async () => {
    setPlacing(true);
    try {
      checkoutKey.current ??= `rep-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await repApi.createOrder(
        retailerId,
        lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        checkoutKey.current
      );
      clearCart();
      checkoutKey.current = null;
      Alert.alert(
        t("orders.place"),
        `GGN-${String(res.order.orderNo).padStart(5, "0")} for ${retailerName} — ${inr(
          Number(res.order.orderTotal)
        )}`,
        [{ text: t("common.save"), onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        Alert.alert(
          "Over credit limit",
          `This order (${inr(e.body.orderTotal)}) exceeds ${retailerName}'s available credit (${inr(
            e.body.availableCredit
          )}). Collect payment or reduce the order.`
        );
      } else {
        Alert.alert(t("errors.generic"), e instanceof ApiError ? e.message : t("errors.generic"));
      }
    } finally {
      setPlacing(false);
    }
  }, [lines, retailerId, retailerName, clearCart, navigation]);

  const cartCount = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.banner}>
        <Ionicons name="storefront-outline" size={15} color={colors.onDark} />
        <Text style={styles.bannerText} numberOfLines={1}>
          Ordering for {retailerName}
        </Text>
      </View>

      <SearchBar value={query} onChange={setQuery} placeholder={t("common.search")} />
      <View style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
        <ChipRow options={[ALL, ...categories]} value={category} onChange={setCategory} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.variant.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: cartCount > 0 ? 140 : 40 }}
          ListEmptyComponent={<EmptyState icon="magnify" title={t("common.search")} />}
          renderItem={({ item }) => {
            const { product, variant } = item;
            const qty = qtyFor(variant.id);
            return (
              <View style={styles.card}>
                <ProductThumb
                  name={product.name}
                  category={product.category}
                  imageUrl={product.imageUrl}
                  size={62}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.pack}>
                    {variant.unitSize} × {variant.unitsPerCase}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      {variant.price != null ? `${inr(variant.price)}/case` : "—"}
                    </Text>
                    {variant.pricePerKg != null && (
                      <Text style={styles.perKg}>{inr(variant.pricePerKg)}/kg</Text>
                    )}
                  </View>
                  {variant.isOverride && <Text style={styles.override}>{t("catalog.specialRate")}</Text>}
                </View>
                <QtyStepper qty={qty} onChange={(next) => setQty(product, variant, next)} compact />
              </View>
            );
          }}
        />
      )}

      {cartCount > 0 && (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barLabel}>
              {cartCount} case{cartCount > 1 ? "s" : ""} · {lines.length} line
              {lines.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.barValue}>{inr(cartTotal)}</Text>
          </View>
          <TouchableOpacity style={styles.placeBtn} disabled={placing} onPress={submit}>
            {placing ? (
              <ActivityIndicator color={colors.onDark} />
            ) : (
              <>
                <Text style={styles.placeText}>{t("orders.place")}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onDark} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.greenDeep,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
  },
  bannerText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  pack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 4 },
  price: { fontSize: 14, fontWeight: "700", color: colors.ink },
  perKg: { fontSize: 11, color: colors.inkMuted },
  override: { fontSize: 10, color: colors.green, fontWeight: "700", marginTop: 3 },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barLabel: { fontSize: 11.5, color: colors.inkMuted },
  barValue: { fontSize: 19, fontWeight: "700", color: colors.ink },
  placeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  placeText: { color: colors.onDark, fontWeight: "700", fontSize: 14.5 },
});
