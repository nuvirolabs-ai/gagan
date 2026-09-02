import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { colors, spacing, inr, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader, ChipRow, EmptyState, StatusPill, OrderTimeline, ScreenSkeleton } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { formatOrderRef } from "../lib/orderRef";

const FILTERS = ["All", "Active", "Delivered", "Rejected"];
const ACTIVE = ["placed", "confirmed", "packed", "out_for_delivery"];

export default function OrderHistoryScreen({ navigation }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { addLine } = useCart();
  const { t } = useLanguage();

  const load = useCallback(async () => {
    const res = await api.getOrders();
    setOrders(res.orders);
    setLoadError(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setOrders([]);
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

  const visible = useMemo(() => {
    if (filter === "Active") return orders.filter((o) => ACTIVE.includes(o.status));
    if (filter === "Delivered") return orders.filter((o) => o.status === "delivered");
    if (filter === "Rejected") return orders.filter((o) => o.status === "rejected");
    return orders;
  }, [orders, filter]);

  const reorder = (order: any) => {
    order.items.forEach((item: any) => {
      addLine({
        variantId: item.variantId,
        productName: item.variant?.product.name ?? "Item",
        packSize: item.variant ? `${item.variant.unitSize} × ${item.variant.unitsPerCase}` : "",
        unitPrice: Number(item.unitPrice),
        qty: item.qtyOrdered,
      });
    });
    navigation.navigate("Cart");
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("orders.title")} subtitle={`${orders.length} total`} />

      <View style={{ marginBottom: spacing.sm }}>
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      {loading ? (
        <ScreenSkeleton chips={false} rows={4} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={loadError ? "alert-circle-outline" : "receipt"}
              title={loadError ? t("orders.loadError") : filter === "All" ? t("orders.noOrders") : t("orders.emptyFilter")}
              body={loadError ? t("errors.checkConnection") : t("orders.noOrdersBody")}
              actionLabel={loadError ? t("common.retry") : filter === "All" ? t("tabs.products") : undefined}
              onAction={() => (loadError ? void load() : navigation.navigate("Products"))}
            />
          }
          renderItem={({ item }) => {
            const isActive = ACTIVE.includes(item.status);
            return (
              <TouchableOpacity
                style={styles.band}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`${formatOrderRef(item)} ${inr(Number(item.orderTotal))}`}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.orderId} numberOfLines={1}>
                      {formatOrderRef(item)}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    <Text
                      style={styles.total}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {inr(Number(item.orderTotal))}
                    </Text>
                    <StatusPill status={item.status} />
                  </View>
                </View>

                <View style={styles.items}>
                  {item.items.slice(0, 2).map((i: any) => (
                    <Text key={i.id} style={styles.itemLine} numberOfLines={1}>
                      {i.variant?.product.name} × {i.qtyOrdered} case
                      {i.qtyOrdered > 1 ? "s" : ""}
                    </Text>
                  ))}
                  {item.items.length > 2 && (
                    <Text style={styles.more}>+{item.items.length - 2} more</Text>
                  )}
                </View>

                {isActive && <OrderTimeline status={item.status} />}

                <View style={styles.cardFoot}>
                  <TouchableOpacity style={styles.reorder} onPress={() => reorder(item)}>
                    <Text style={styles.reorderText}>{t("orders.reorder")}</Text>
                  </TouchableOpacity>
                  <View style={styles.detailsLink}>
                    <Text style={styles.detailsText}>{t("orders.details")}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.inkFaint} />
                  </View>
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

  band: {
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  orderId: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  date: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  total: { fontSize: 15, fontWeight: "700", color: colors.ink, maxWidth: 110, textAlign: "right" },

  items: { marginTop: spacing.md, gap: 3 },
  itemLine: { fontSize: 12.5, color: colors.inkMuted },
  more: { fontSize: 11.5, color: colors.green, fontWeight: "600" },

  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  reorder: { minHeight: 36, justifyContent: "center" },
  reorderText: { color: colors.green, fontWeight: "700", fontSize: 13 },
  detailsLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  detailsText: { fontSize: 13, color: colors.green, fontWeight: "600" },
});
