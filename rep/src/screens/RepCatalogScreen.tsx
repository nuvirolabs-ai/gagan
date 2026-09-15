import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { currentSellingVisit, type SellingVisit } from "./sellingFlow";
import { staffCapabilities } from "../auth/staffCapabilities";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { colors, radius, spacing, inr } from "../theme";
import ProductThumb from "../components/ProductThumb";
import { SearchBar, ChipRow, QtyStepper, EmptyState, SecondaryButton } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { catalogGroups, selectedCatalogSku, type CatalogGroup } from "../lib/catalogSelection";

const ALL = "All";

export default function RepCatalogScreen({ route, navigation }: any) {
  const { retailerId, retailerName } = route.params;
  const { lines, addLine, updateQty, cartTotal, staff } = useRep();
  const insets = useSafeAreaInsets();
  const [sellingVisit, setSellingVisit] = useState<SellingVisit | null>(null);
  const canLogActivity = staffCapabilities(staff?.permissions ?? []).canLogActivity;
  useFocusEffect(useCallback(() => {
    let active = true;
    setSellingVisit(null);
    if (canLogActivity) {
      void Promise.all([repApi.visits(), repApi.customerActivities(retailerId), repApi.retailer(retailerId)])
        .then(([visits, activities, retailer]) => {
          if (active) setSellingVisit(currentSellingVisit({
            visits: visits.visits ?? [], activities: activities.activities ?? [],
            orders: retailer.recentOrders ?? [], retailerId, staffId: staff?.id,
            visitId: route.params?.visitId,
          }));
        }).catch(() => { if (active) setSellingVisit(null); });
    }
    return () => { active = false; };
  }, [retailerId, route.params?.visitId, staff?.id, canLogActivity]));
  const { t } = useLanguage();

  const [products, setProducts] = useState<CatalogGroup[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    repApi
      .catalogFor(retailerId)
      .then((res) => {
        setProducts(catalogGroups(res));
        setCategories(res.categories ?? []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [retailerId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => category === ALL || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.skus.some(sku => sku.unitSize.toLowerCase().includes(q)));
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

  const cartCount = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="storefront-outline" size={16} color={colors.blue} />
        </View>
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
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg }}
          ListEmptyComponent={<EmptyState icon="magnify" title={t("common.search")} />}
          renderItem={({ item }) => {
            const product = item;
            const variant = selectedCatalogSku(product, selectedSkus[product.id], qtyFor);
            const qty = qtyFor(variant.id);
            return (
              <View style={[styles.card, product.skus.some(sku => qtyFor(sku.id) > 0) && styles.cardSelected]}>
                <View style={styles.productRow}>
                <ProductThumb
                  name={product.name}
                  category={product.category}
                  imageUrl={product.imageUrl}
                  size={72}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.pack}>
                    {variant.unitSize} × {variant.unitsPerCase}
                  </Text>
                  <View style={styles.priceStack}>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>
                        {variant.price != null ? `${inr(variant.price)}/case` : "—"}
                      </Text>
                    </View>
                    {variant.pricePerKg != null ? <Text style={styles.perKg}>{inr(variant.pricePerKg)}/kg</Text> : null}
                  </View>
                  {variant.isOverride && <Text style={styles.override}>{t("catalog.specialRate")}</Text>}
                </View>
                {qty === 0 ? <QtyStepper qty={qty} onChange={(next) => setQty(product, variant, next)} compact /> : null}
                </View>
                {product.skus.length > 1 || qty > 0 ? <View style={styles.controlsRow}>
                {product.skus.length > 1 ? <View style={styles.packOptions}>
                  {product.skus.map(sku => <TouchableOpacity key={sku.id}
                    style={[styles.packOption, sku.id === variant.id && styles.packOptionSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sku.id === variant.id }}
                    accessibilityLabel={`${product.name}, ${sku.unitSize}, ${qtyFor(sku.id)} cases in cart`}
                    onPress={() => setSelectedSkus(previous => ({ ...previous, [product.id]: sku.id }))}>
                    <Text style={styles.packOptionText}>{sku.unitSize}{qtyFor(sku.id) > 0 ? ` · ${qtyFor(sku.id)}` : ""}</Text>
                  </TouchableOpacity>)}
                </View> : null}
                {qty > 0 ? <View style={{ marginLeft: "auto" }}>
                  <QtyStepper qty={qty} onChange={(next) => setQty(product, variant, next)} compact />
                </View> : null}
                </View> : null}
              </View>
            );
          }}
        />
      )}

      {(cartCount > 0 || sellingVisit) && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {cartCount > 0 && (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barLabel}>
              {cartCount} case{cartCount > 1 ? "s" : ""} · {lines.length} line
              {lines.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.barValue}>{inr(cartTotal)}</Text>
          </View>
          <TouchableOpacity style={styles.placeBtn} accessibilityRole="button" onPress={() => navigation.navigate("RepReviewOrder", { retailerId, retailerName })}>
            <Text style={styles.placeText}>Review order</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.onDark} />
          </TouchableOpacity>
        </View>
      )}
      {sellingVisit ? <SecondaryButton label="NOT ORDERING" onPress={() => navigation.navigate("Visit", {
        visitId: sellingVisit.id, retailerId, retailerName, composeActivity: true,
      })} /> : null}
      </View>}
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
    backgroundColor: colors.blueSoft,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  bannerIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { color: colors.blueInk, fontWeight: "700", fontSize: 13.5 },
  quoteStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quoteStatusCopy: { flex: 1, minWidth: 0 },
  quoteStatusTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  quoteStatusBody: { color: colors.inkMuted, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  refreshButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.greenDeep,
  },
  refreshButtonText: { color: colors.onDark, fontSize: 12.5, fontWeight: "700" },
  quoteId: { color: colors.inkMuted, fontSize: 10.5 },
  rateApprovalButton: { alignSelf: "flex-start", minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.navy },
  rateApprovalButtonText: { color: colors.onDark, fontSize: 13, fontWeight: "700" },

  card: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  productRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  controlsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  packOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  packOption: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  packOptionSelected: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  packOptionText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  cardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  pack: { fontSize: 12, color: colors.inkMuted, marginTop: 3 },
  priceStack: { marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  // Keep both price contexts legible. If a very narrow device cannot fit the
  // pair, the wrapping row gives the per-kg value its own line instead of
  // truncating it with an ellipsis.
  price: { fontSize: 14.5, fontWeight: "700", color: colors.ink, flexShrink: 0 },
  perKg: { fontSize: 11, color: colors.inkMuted, marginTop: 1 },
  override: { fontSize: 10, color: colors.blue, fontWeight: "700", marginTop: 3 },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barLabel: { fontSize: 11.5, color: colors.inkMuted },
  footer: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, gap: spacing.sm },
  barValue: { fontSize: 19, fontWeight: "700", color: colors.ink },
  placeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.blue,
    borderRadius: radius.lg,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  placeText: { color: colors.onDark, fontWeight: "700", fontSize: 14.5 },
});
