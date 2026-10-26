import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppScreen, EmptyState, StatusPill, Surface } from "../components/ui";
import { repApi } from "../api/repClient";
import { formatOrderRef } from "../lib/orderRef";
import { colors, inr, radius, spacing } from "../theme";

const TABS = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "On the Road" },
  { key: "delivered", label: "Delivered" },
  { key: "rejected", label: "Cancelled" },
];

function isSameDay(dateInput: string | Date | null | undefined) {
  if (!dateInput) return false;
  const d1 = new Date(dateInput);
  if (isNaN(d1.getTime())) return false;
  const d2 = new Date();
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export default function RepOrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await repApi.orders();
      setOrders(res.orders ?? []);
    } catch {
      setOrders([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCancelOrder = (order: any) => {
    const ref = formatOrderRef(order);
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel ${ref}? This cannot be undone.`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Yes, Cancel Order",
          style: "destructive",
          onPress: async () => {
            setCancellingId(order.id);
            try {
              await repApi.cancelOrder(order.id);
              Alert.alert("Order Cancelled", `${ref} has been cancelled.`);
              await load();
            } catch (err: any) {
              Alert.alert(
                "Could not cancel order",
                err?.message ?? "Orders can only be cancelled on the same day before dispatch."
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab !== "all" && o.status !== activeTab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const ref = formatOrderRef(o).toLowerCase();
      const retailer = (o.retailer?.name ?? "").toLowerCase();
      const city = (o.retailer?.deliveryCity ?? "").toLowerCase();
      return ref.includes(q) || retailer.includes(q) || city.includes(q);
    });
  }, [orders, activeTab, search]);

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.headerArea}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.inkFaint} />
          <TextInput
            placeholder="Search order ref, retailer name, or city…"
            placeholderTextColor={colors.inkFaint}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabScroll}
          renderItem={({ item }) => {
            const isSelected = activeTab === item.key;
            return (
              <Pressable
                onPress={() => setActiveTab(item.key)}
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No orders found"
            body={search ? "Try a different search term." : "No orders punched in this category."}
          />
        }
        renderItem={({ item: order }) => {
          const totalCases = (order.items ?? []).reduce(
            (sum: number, it: any) => sum + (it.qtyOrdered || 0),
            0
          );
          const isEligibleForDirectCancel =
            isSameDay(order.createdAt) &&
            (order.status === "placed" || order.status === "confirmed");
          const isEligibleForRequestCancel =
            isSameDay(order.createdAt) &&
            (order.status === "packed" || order.status === "out_for_delivery") &&
            !order.cancellationStatus;
          const isPendingCancellation = order.cancellationStatus === "pending";
          const isApprovedCancelled = order.cancellationStatus === "approved" || order.status === "rejected";

          return (
            <Surface style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderRef}>{formatOrderRef(order)}</Text>
                  <Text style={styles.dateText}>
                    {order.createdAt && !isNaN(new Date(order.createdAt).getTime())
                      ? new Date(order.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <StatusPill status={order.status} />
                  {isPendingCancellation && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>⏳ Review Pending</Text>
                    </View>
                  )}
                  {order.cancellationStatus === "declined" && (
                    <View style={styles.declinedBadge}>
                      <Text style={styles.declinedBadgeText}>⚠️ Cancel Declined</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.retailerSection}>
                <Text style={styles.retailerName}>{order.retailer?.name ?? "Retailer unavailable"}</Text>
                {order.retailer?.deliveryCity || order.retailer?.shopAddress ? (
                  <Text style={styles.retailerLocation} numberOfLines={1}>
                    📍 {order.retailer?.deliveryCity ?? order.retailer?.shopAddress}
                  </Text>
                ) : null}
              </View>

              {/* Items summary */}
              <View style={styles.itemsSummary}>
                <Text style={styles.itemsText}>
                  {order.items?.length ?? 0} items · {totalCases} bags/boxes
                </Text>
                <Text style={styles.amountText}>
                  {inr(Number(order.orderTotal ?? order.invoice?.total ?? 0))}
                </Text>
              </View>

              {/* Delivery & Remarks tags */}
              <View style={styles.tagsRow}>
                {order.expectedDeliveryAt && !isNaN(new Date(order.expectedDeliveryAt).getTime()) ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      📅 {new Date(order.expectedDeliveryAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                ) : null}
                {order.transportName ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>🚚 {order.transportName}</Text>
                  </View>
                ) : null}
                {order.remarks ? (
                  <View style={[styles.tag, styles.remarksTag]}>
                    <Text style={[styles.tagText, styles.remarksText]} numberOfLines={1}>
                      💬 {order.remarks}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.detailsButton}
                  onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
                >
                  <Text style={styles.detailsButtonText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.blue} />
                </Pressable>

                {isEligibleForDirectCancel ? (
                  <Pressable
                    disabled={cancellingId === order.id}
                    style={styles.cancelButton}
                    onPress={() => handleCancelOrder(order)}
                  >
                    <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                    <Text style={styles.cancelButtonText}>
                      {cancellingId === order.id ? "Cancelling…" : "Cancel Order"}
                    </Text>
                  </Pressable>
                ) : isEligibleForRequestCancel ? (
                  <Pressable
                    style={styles.requestCancelButton}
                    onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
                  >
                    <Ionicons name="hand-right-outline" size={14} color="#c2410c" />
                    <Text style={styles.requestCancelButtonText}>Request Cancel</Text>
                  </Pressable>
                ) : isApprovedCancelled && order.retailer?.id ? (
                  <Pressable
                    style={styles.reorderButton}
                    onPress={() => navigation.navigate("Order", { retailerId: order.retailer.id, retailer: order.retailer })}
                  >
                    <Ionicons name="cart-outline" size={14} color={colors.blue} />
                    <Text style={styles.reorderButtonText}>Punch New Order</Text>
                  </Pressable>
                ) : null}
              </View>
            </Surface>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerArea: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    height: 42,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink },
  tabScroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: 8 },
  tabButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  tabButtonActive: { backgroundColor: colors.blue },
  tabText: { fontSize: 12, fontWeight: "600", color: colors.inkMuted },
  tabTextActive: { color: colors.onDark },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 60 },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderRef: { fontSize: 15, fontWeight: "800", color: colors.ink },
  dateText: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  retailerSection: { marginBottom: spacing.xs },
  retailerName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  retailerLocation: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  itemsSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  itemsText: { fontSize: 12, color: colors.inkMuted, fontWeight: "500" },
  amountText: { fontSize: 16, fontWeight: "800", color: colors.greenDeep },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  tag: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 11, color: colors.inkMuted, fontWeight: "600" },
  remarksTag: { backgroundColor: "#fef9c3" },
  remarksText: { color: "#854d0e" },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  detailsButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailsButtonText: { fontSize: 13, fontWeight: "700", color: colors.blue },
  cancelButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" },
  cancelButtonText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  requestCancelButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" },
  requestCancelButtonText: { fontSize: 12, fontWeight: "700", color: "#c2410c" },
  reorderButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe" },
  reorderButtonText: { fontSize: 12, fontWeight: "700", color: colors.blue },
  pendingBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "#fde68a" },
  pendingBadgeText: { fontSize: 10, fontWeight: "700", color: "#92400e" },
  declinedBadge: { backgroundColor: "#ffedd5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "#fed7aa" },
  declinedBadgeText: { fontSize: 10, fontWeight: "700", color: "#9a3412" },
});
