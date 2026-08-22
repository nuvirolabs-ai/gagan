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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { colors, radius, spacing, shadow, inr, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader, ChipRow, EmptyState, StatusPill, OrderTimeline } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

const FILTERS = ["All", "Active", "Delivered", "Rejected"];
const ACTIVE = ["placed", "confirmed", "packed", "out_for_delivery"];

export default function OrderHistoryScreen({ navigation }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addLine } = useCart();
  const { t } = useLanguage();

  const load = useCallback(async () => {
    const res = await api.getOrders();
    setOrders(res.orders);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setOrders([]))
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt"
              title={filter === "All" ? t("orders.noOrders") : t("errors.generic")}
              body={
                filter === "All"
                  ? t("orders.noOrders")
                  : t("common.retry")
              }
              actionLabel={filter === "All" ? t("tabs.products") : undefined}
              onAction={() => navigation.navigate("Products")}
            />
          }
          renderItem={({ item }) => {
            const isActive = ACTIVE.includes(item.status);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderId}>
                      GGN-{String(item.orderNo).padStart(5, "0")}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <Text style={styles.total}>{inr(Number(item.orderTotal))}</Text>
                    <StatusPill status={item.status} />
                  </View>
                </View>

                <View style={styles.items}>
                  {item.items.slice(0, 2).map((i: any) => (
                    <Text key={i.id} style={styles.itemLine} numberOfLines={1}>
                      • {i.variant?.product.name} × {i.qtyOrdered} case
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
                    <MaterialCommunityIcons name="refresh" size={13} color={colors.green} />
                    <Text style={styles.reorderText}>{t("orders.reorder")}</Text>
                  </TouchableOpacity>
                  <View style={styles.detailsLink}>
                    <Text style={styles.detailsText}>{t("orders.details")}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.inkMuted} />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  orderId: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
  date: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  total: { fontSize: 15.5, fontWeight: "700", color: colors.ink },

  items: { marginTop: spacing.md, gap: 3 },
  itemLine: { fontSize: 12.5, color: colors.inkMuted },
  more: { fontSize: 11.5, color: colors.greenMid, fontWeight: "600" },

  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reorder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reorderText: { color: colors.green, fontWeight: "700", fontSize: 12.5 },
  detailsLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  detailsText: { fontSize: 12.5, color: colors.inkMuted, fontWeight: "600" },
});
