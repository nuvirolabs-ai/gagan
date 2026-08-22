import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../api/client";
import { colors, radius, spacing, shadow, inr, TAB_BAR_SPACE } from "../theme";
import ProductThumb from "../components/ProductThumb";
import { ScreenHeader, SearchBar, ChipRow, QtyStepper, EmptyState } from "../components/ui";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

const ALL = "All";

export default function CatalogScreen({ navigation }: any) {
  const { lines, addLine, updateQty } = useCart();
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getCatalog();
    setProducts(res.catalog);
    setCategories(res.categories ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  // One row per sellable case, so a multi-variant product lists each pack size.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => category === ALL || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .flatMap((p) => p.variants.map((v: any) => ({ product: p, variant: v })));
  }, [products, category, query]);

  const qtyFor = (variantId: string) => lines.find((l) => l.variantId === variantId)?.qty ?? 0;

  const setQty = (product: any, variant: any, next: number) => {
    if (variant.price == null) return;
    const current = qtyFor(variant.id);
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
      <ScreenHeader
        title={t("catalog.title")}
        subtitle={t("catalog.count", { count: rows.length })}
        right={
          cartCount > 0 ? (
            <TouchableOpacity style={styles.cartChip} onPress={() => navigation.navigate("Cart")}>
              <Ionicons name="cart-outline" size={15} color={colors.onDark} />
              <Text style={styles.cartChipText}>{cartCount}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <SearchBar value={query} onChange={setQuery} placeholder={t("catalog.search")} />

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
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="magnify"
              title={t("common.search")}
              body={t("errors.generic")}
              actionLabel={query || category !== ALL ? t("common.clearFilters") : undefined}
              onAction={() => {
                setQuery("");
                setCategory(ALL);
              }}
            />
          }
          renderItem={({ item }) => {
            const { product, variant } = item;
            const qty = qtyFor(variant.id);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("ProductDetail", { productId: product.id })}
              >
                <ProductThumb
                  name={product.name}
                  category={product.category}
                  imageUrl={product.imageUrl}
                  size={72}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.pack}>
                    {variant.unitSize} × {variant.unitsPerCase} · {variant.caseWeightKg}kg case
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      {variant.price != null ? `${inr(variant.price)} / case` : t("common.priceOnRequest")}
                    </Text>
                    {variant.pricePerKg != null && (
                      <Text style={styles.perKg}>{inr(variant.pricePerKg)}/kg</Text>
                    )}
                  </View>
                  {variant.isOverride && (
                    <View style={styles.dealTag}>
                      <Ionicons name="pricetag" size={9} color={colors.green} />
                      <Text style={styles.dealText}>{t("catalog.specialRate")}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.action}>
                  <QtyStepper qty={qty} onChange={(next) => setQty(product, variant, next)} compact />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  cartChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.greenDeep,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  cartChipText: { color: colors.onDark, fontWeight: "700", fontSize: 12.5 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardBody: { flex: 1 },
  name: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
  pack: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 6 },
  price: { fontSize: 15, fontWeight: "700", color: colors.ink },
  perKg: { fontSize: 11.5, color: colors.inkMuted },
  dealTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: colors.greenSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 5,
  },
  dealText: { fontSize: 9.5, fontWeight: "700", color: colors.green },
  action: { alignItems: "flex-end" },
});
