import React, { useCallback, useState } from "react";
import CommercialBreakdown from "../components/CommercialBreakdown";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppScreen, EmptyState, OrderTimeline, PrimaryButton, SecondaryButton, SectionHeader, StatusPill, Surface } from "../components/ui";
import { repApi } from "../api/repClient";
import { formatOrderRef } from "../lib/orderRef";
import { hasOrderAmountMismatch } from "../lib/orderAmountMismatch";
import { colors, inr, radius, spacing } from "../theme";
import { nextOrderVisitAction, type OrderVisitAction } from "./orderVisitAction";

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

const STATUS_LABELS: Record<string, string> = {
  placed: "Order placed",
  confirmed: "Confirmed by operations",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
};

function eventLabel(action: string) {
  const status = action.replace(/^order\./, "");
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function InternalCommercialStatus({ status }: { status: any }) {
  if (!status) return null;
  return (
    <Surface>
      <SectionHeader title="Internal commercial status" />
      <Text style={styles.internalCurrent}>{status.currentLabel ?? "No internal status recorded"}</Text>
      {status.isOnHold && status.holdReason ? <Text style={styles.internalReason}>Reason: {status.holdReason}</Text> : null}
      <Text style={styles.internalKicker}>INTERNAL JOURNEY</Text>
      {(status.timeline ?? []).map((event: any) => (
        <View key={event.id} style={styles.internalEventRow}>
          <Text style={styles.internalEventLabel}>{event.label}</Text>
          <Text style={styles.muted}>{new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{event.actor?.name ? ` · ${event.actor.name}` : ""}</Text>
        </View>
      ))}
      {status.latestAdvancePayment ? <Text style={styles.internalAdvance}>{status.latestAdvancePayment.label} · {inr(status.latestAdvancePayment.amount ?? 0)}</Text> : null}
    </Surface>
  );
}

export default function OrderDetailScreen({ route, navigation }: any) {
  const orderId = route?.params?.orderId as string;
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [visitAction, setVisitAction] = useState<OrderVisitAction | null>(null);

  const load = useCallback(async () => {
    const result = await repApi.order(orderId);
    setData(result);
    // A failed visit read must never manufacture "Next retailer" eligibility.
    setVisitAction(null);
    try {
      const visitResult = await repApi.visits();
      setVisitAction(nextOrderVisitAction(result.order, visitResult.visits ?? []));
    } catch {
      setVisitAction(null);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => Alert.alert("Could not load the order", "Try again when you have a connection.")).finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return <AppScreen><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></AppScreen>;
  }
  if (!data?.order) {
    return <AppScreen><EmptyState icon="receipt-outline" title="Order not found" body="This order is not in your assigned customer scope." /></AppScreen>;
  }

  const { order, events = [] } = data;
  const eventRows = [
    { id: `placed-${order.id}`, label: "Order placed", at: order.createdAt },
    ...events.map((event: any) => ({ id: event.id, label: eventLabel(event.action), at: event.createdAt })),
  ];

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          try { await load(); }
          catch { Alert.alert("Could not refresh", "Your last order details are still shown. Please try again when connected."); }
          finally { setRefreshing(false); }
        }} tintColor={colors.primary} />}
      >
        <Surface>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>ORDER DETAIL</Text>
              <Text style={styles.title}>{formatOrderRef(order)}</Text>
              <Text style={styles.retailer}>{order.retailer?.name ?? "Assigned retailer"}</Text>
            </View>
            <StatusPill status={order.status} />
          </View>
          <Text style={styles.muted}>
            {order.source === "SALESPERSON_APP" || order.placedBy === "rep"
              ? `Order punched by ${order.creatorName ?? "Salesperson"}`
              : "Order placed via Retailer App"} · {order.createdAt && !isNaN(new Date(order.createdAt).getTime())
                ? new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                : "—"}
          </Text>
          {order.retailer?.shopAddress ? <Text style={styles.muted}>{order.retailer.shopAddress}</Text> : null}
          {(order.expectedDeliveryAt || order.transportName || order.remarks) ? (
            <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.separator, gap: 4 }}>
              {order.expectedDeliveryAt && !isNaN(new Date(order.expectedDeliveryAt).getTime()) ? (
                <Text style={styles.muted}>📅 Dispatch Date: <Text style={{ fontWeight: "600", color: colors.ink }}>{new Date(order.expectedDeliveryAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></Text>
              ) : null}
              {order.transportName ? (
                <Text style={styles.muted}>🚚 Transport: <Text style={{ fontWeight: "600", color: colors.ink }}>{order.transportName}</Text></Text>
              ) : null}
              {order.remarks ? (
                <Text style={styles.muted}>💬 Remarks: <Text style={{ fontWeight: "600", color: colors.ink }}>{order.remarks}</Text></Text>
              ) : null}
            </View>
          ) : null}
          <OrderTimeline status={order.status} />
        </Surface>

        <InternalCommercialStatus status={data.commercialStatus} />

        <Surface>
          <SectionHeader title={`Order Items (${(order.items ?? []).length})`} />
          {(() => {
            const rawItems: any[] = (order.items && order.items.length > 0)
              ? order.items
              : (order.commercialSnapshot?.lines ?? []);

            if (rawItems.length === 0) {
              return (
                <Text style={[styles.muted, { paddingVertical: spacing.md }]}>
                  No items recorded in this order.
                </Text>
              );
            }

            let computedItemsTotal = 0;

            const itemNodes = rawItems.map((item: any, idx: number) => {
              const name = item.variant?.product?.name ?? item.productName ?? item.name ?? "Product";
              const pack = item.variant?.unitSize
                ? `${item.variant.unitSize} × ${item.variant.unitsPerCase ?? 1}`
                : (item.pack ?? item.packSize ?? "");
              const isBox = item.variant?.catalogIdentityMasterPack?.toUpperCase()?.includes("BOX");
              const unitLabel = isBox ? "Box" : "Bag";
              const qty = Number(item.qtyOrdered ?? item.cases ?? item.qty ?? 1);
              const unitPrice = Number(item.unitPrice ?? item.rate ?? 0);
              const lineTotal = Number(item.lineTotal ?? (unitPrice * qty));
              computedItemsTotal += lineTotal;

              return (
                <View key={item.id ?? `item-${idx}`} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{name}</Text>
                    <Text style={styles.muted}>
                      {pack ? `${pack} · ` : ""}Qty: <Text style={{ fontWeight: "700", color: colors.ink }}>{qty} {qty > 1 ? `${unitLabel}s` : unitLabel}</Text>
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>{inr(lineTotal)}</Text>
                    <Text style={[styles.muted, { textAlign: "right" }]}>
                      {inr(unitPrice)} / {unitLabel.toLowerCase()}
                    </Text>
                  </View>
                </View>
              );
            });

            const finalOrderTotal = Number(order.orderTotal ?? order.total ?? (computedItemsTotal > 0 ? computedItemsTotal : 0));

            return (
              <>
                {itemNodes}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Order Total</Text>
                  <Text style={styles.totalValue}>{inr(finalOrderTotal)}</Text>
                </View>
                {hasOrderAmountMismatch(order) && (
                  <Text style={styles.amountWarning}>
                    The item amounts do not add up to the recorded order total. Confirm the amount with Gagan before relying on it.
                  </Text>
                )}
              </>
            );
          })()}
        </Surface>

        {order.commercialSnapshot && (order.commercialSnapshot.freight || order.commercialSnapshot.routing || order.commercialSnapshot.entities?.length) ? (
          <CommercialBreakdown value={order.commercialSnapshot} />
        ) : null}

        <Surface>
          <SectionHeader title="Recorded progress" />
          {eventRows.map((event: any, index: number) => <View key={event.id} style={styles.eventRow}><View style={[styles.eventDot, index === eventRows.length - 1 && styles.eventDotCurrent]} /><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{event.label}</Text><Text style={styles.muted}>{event.at && !isNaN(new Date(event.at).getTime()) ? new Date(event.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</Text></View></View>)}
        </Surface>

        {order.invoice ? <Surface><SectionHeader title="Invoice" /><View style={styles.invoiceRow}><Text style={styles.muted}>Invoice #{order.invoice.invoiceNumber}</Text><Text style={styles.totalValue}>{inr(Number(order.invoice.total))}</Text></View>{order.invoice.commercialSnapshot && <CommercialBreakdown value={order.invoice.commercialSnapshot}/>}<Text style={styles.muted}>{order.invoice.outstandingAmount > 0 ? `${inr(Number(order.invoice.outstandingAmount))} outstanding` : "Settled"}</Text></Surface> : null}

        {isSameDay(order.createdAt) && (order.status === "placed" || order.status === "confirmed") ? (
          <Surface style={{ borderColor: "#fecaca", backgroundColor: "#fff5f5" }}>
            <SectionHeader title="Order Cancellation" />
            <Text style={{ fontSize: 13, color: colors.inkMuted, marginBottom: spacing.md, lineHeight: 18 }}>
              This order was punched today and has not been dispatched yet. You can cancel it if necessary.
            </Text>
            <Pressable
              disabled={cancelling}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: colors.danger,
                paddingVertical: 12,
                borderRadius: radius.md,
              }}
              onPress={() => {
                Alert.alert(
                  "Cancel Order",
                  `Are you sure you want to cancel order ${formatOrderRef(order)}? This cannot be undone.`,
                  [
                    { text: "Keep Order", style: "cancel" },
                    {
                      text: "Yes, Cancel Order",
                      style: "destructive",
                      onPress: async () => {
                        setCancelling(true);
                        try {
                          await repApi.cancelOrder(order.id);
                          Alert.alert("Order Cancelled", "This order has been cancelled.");
                          await load();
                        } catch (err: any) {
                          Alert.alert("Could not cancel", err?.message ?? "Cancellation failed.");
                        } finally {
                          setCancelling(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>
                {cancelling ? "Cancelling Order…" : "Cancel Order"}
              </Text>
            </Pressable>
          </Surface>
        ) : null}

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <PrimaryButton
            label="Back to Orders"
            icon="arrow-back"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("RepOrders");
              }
            }}
          />
          {order.retailerId ? (
            <SecondaryButton
              label="Open Retailer Profile"
              icon="storefront-outline"
              onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: order.retailerId })}
            />
          ) : null}
        </View>
        <Text style={styles.footer}>This view reflects the order accepted by Gagan. Reopen the retailer profile to review the same order later.</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  kicker: { color: colors.inkMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "700", marginTop: 5 },
  retailer: { color: colors.ink, fontSize: 16, fontWeight: "600", marginTop: spacing.sm },
  muted: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18 },
  itemRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.separator },
  itemName: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  itemRight: { alignItems: "flex-end", flexShrink: 0, minWidth: 95 },
  itemPrice: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.lg },
  totalLabel: { color: colors.inkMuted, fontSize: 14, fontWeight: "600" },
  totalValue: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  amountWarning: { color: colors.danger, fontSize: 12.5, lineHeight: 18, marginTop: spacing.sm },
  eventRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm, alignItems: "flex-start" },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 4 },
  eventDotCurrent: { backgroundColor: colors.primary },
  eventTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  invoiceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  internalCurrent: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "700", marginBottom: spacing.sm },
  internalKicker: { color: colors.inkMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.xs },
  internalReason: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  internalEventRow: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  internalEventLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  internalAdvance: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  footer: { color: colors.inkFaint, fontSize: 12, lineHeight: 17, textAlign: "center", marginBottom: spacing.md },
});
