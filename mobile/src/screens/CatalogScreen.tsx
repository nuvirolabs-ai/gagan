import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../api/client";
import { colors, radius, spacing, TAB_BAR_SPACE } from "../theme";
import ProductGroupCard, { type ProductGroupLike, type Sku } from "../components/ProductGroupCard";
import { ScreenHeader, SearchBar, ChipRow, EmptyState, ScreenSkeleton } from "../components/ui";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

const ALL = "All";
const CATEGORY_LABELS: Record<string, string> = {
  All: "All",
  Pulses: "Daal",
  Daal: "Daal",
  Rice: "Rice",
  Sugar: "Sugar",
  Staples: "Staples",
  Breakfast: "Breakfast",
};

export default function CatalogScreen({ navigation }: any) {
  const { lines, addLine, updateQty } = useCart();
  const { t } = useLanguage();
  const [groups, setGroups] = useState<ProductGroupLike[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getCatalog();
    setGroups(res.groups ?? []);
    setCategories(res.categories ?? []);
    setLoadError(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setGroups([]);
          setLoadError(true);
        })
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  // One row per logical product. A pack size is a choice inside the card, not
  // a reason to list the same product again.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((group) => category === ALL || group.category === category)
      .filter(
        (group) =>
          !q ||
          group.name.toLowerCase().includes(q) ||
          group.category.toLowerCase().includes(q) ||
          group.skus.some((sku) => sku.packLabel.toLowerCase().includes(q))
      );
  }, [groups, category, query]);

  const qtyFor = (variantId: string) => lines.find((l) => l.variantId === variantId)?.qty ?? 0;

  const setQty = (group: ProductGroupLike, sku: Sku, next: number) => {
    if (sku.price == null) return;
    const current = qtyFor(sku.id);
    const availability = sku.availability;
    const orderable =
      !availability || availability.status == null || availability.status === "unknown"
        ? true
        : availability.status === "available" && Number(availability.available ?? 0) > 0;
    // Inventory is authoritative in the API. Allow a shopper to remove an
    // already-saved line, but never add a new case when SAP has not supplied
    // usable stock for it.
    if (next > current && !orderable) return;
    if (current === 0 && next > 0) {
      addLine({
        variantId: sku.id,
        productName: group.name,
        packSize: sku.packDetail,
        unitPrice: Number(sku.price),
        qty: next,
      });
    } else {
      updateQty(sku.id, next);
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
        <ChipRow
          options={[ALL, ...categories]}
          value={category}
          onChange={setCategory}
          labels={{ ...CATEGORY_LABELS, [ALL]: t("home.allCategories") }}
        />
      </View>

      {loading ? (
        <ScreenSkeleton featured rows={3} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(group) => group.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={loadError ? "alert-circle-outline" : "magnify"}
              title={loadError ? t("catalog.loadError") : t("catalog.empty")}
              body={loadError ? t("errors.checkConnection") : t("catalog.emptyBody")}
              actionLabel={loadError ? t("common.retry") : query || category !== ALL ? t("common.clearFilters") : undefined}
              onAction={
                loadError
                  ? () => {
                      setLoading(true);
                      void load()
                        .catch(() => setLoadError(true))
                        .finally(() => setLoading(false));
                    }
                  : () => {
                      setQuery("");
                      setCategory(ALL);
                    }
              }
            />
          }
          renderItem={({ item, index }) => (
            <ProductGroupCard
              group={item}
              qtyFor={qtyFor}
              onChangeQty={(sku, next) => setQty(item, sku, next)}
              onOpen={() =>
                navigation.navigate("ProductDetail", { productId: item.skus[0]?.productId })
              }
              appearance={index === 0 ? "featured" : "row"}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  cartChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.greenDeep,
    paddingHorizontal: 11,
    paddingVertical: 7,
    minHeight: 36,
    borderRadius: radius.pill,
  },
  cartChipText: { color: colors.onDark, fontWeight: "700", fontSize: 12.5 },
});
