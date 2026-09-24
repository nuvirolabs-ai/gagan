import React, { useCallback, useState } from "react";
import CommercialBreakdown from "../components/CommercialBreakdown";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { AppScreen, EmptyState, OrderTimeline, PrimaryButton, SectionHeader, StatusPill, Surface } from "../components/ui";
import { repApi } from "../api/repClient";
import { formatOrderRef } from "../lib/orderRef";
import { colors, inr, spacing } from "../theme";
import { nextOrderVisitAction, type OrderVisitAction } from "./orderVisitAction";

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
          <Text style={styles.muted}>{order.placedBy === "rep" ? "Placed from Salesperson" : "Placed from Retailer"} · {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Text>
          {order.retailer?.shopAddress ? <Text style={styles.muted}>{order.retailer.shopAddress}</Text> : null}
          <OrderTimeline status={order.status} />
        </Surface>

        <InternalCommercialStatus status={data.commercialStatus} />

        {order.commercialSnapshot ? <CommercialBreakdown value={order.commercialSnapshot}/> : <Surface>
          <SectionHeader title="Items" />
          {(order.items ?? []).map((item: any) => {
            const name = item.variant?.product?.name ?? "Product";
            const pack = item.variant?.unitSize ? `${item.variant.unitSize} × ${item.variant.unitsPerCase ?? 1}` : "";
            const lineTotal = Number(item.unitPrice) * Number(item.qtyOrdered);
            return <View key={item.id} style={styles.itemRow}><View style={{ flex: 1 }}><Text style={styles.itemName}>{name}</Text><Text style={styles.muted}>{pack || "Standard pack"} · Qty {item.qtyOrdered}</Text></View><View style={styles.itemRight}><Text style={styles.itemPrice}>{inr(lineTotal)}</Text><Text style={styles.muted}>{inr(Number(item.unitPrice))} each</Text></View></View>;
          })}
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Order total</Text><Text style={styles.totalValue}>{inr(Number(order.orderTotal))}</Text></View>
        </Surface>}

        <Surface>
          <SectionHeader title="Recorded progress" />
          {eventRows.map((event: any, index: number) => <View key={event.id} style={styles.eventRow}><View style={[styles.eventDot, index === eventRows.length - 1 && styles.eventDotCurrent]} /><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{event.label}</Text><Text style={styles.muted}>{new Date(event.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Text></View></View>)}
        </Surface>

        {order.invoice ? <Surface><SectionHeader title="Invoice" /><View style={styles.invoiceRow}><Text style={styles.muted}>Invoice #{order.invoice.invoiceNumber}</Text><Text style={styles.totalValue}>{inr(Number(order.invoice.total))}</Text></View>{order.invoice.commercialSnapshot && <CommercialBreakdown value={order.invoice.commercialSnapshot}/>}<Text style={styles.muted}>{order.invoice.outstandingAmount > 0 ? `${inr(Number(order.invoice.outstandingAmount))} outstanding` : "Settled"}</Text></Surface> : null}

        {visitAction?.kind === "continue_visit" ? (
          <PrimaryButton
            label="Continue Visit"
            icon="arrow-forward"
            onPress={() => navigation.navigate("Visit", { visitId: visitAction.visitId, retailerId: order.retailerId, retailerName: order.retailer?.name ?? "Retailer" })}
          />
        ) : visitAction?.kind === "next_retailer" ? (
          <PrimaryButton label="Visit complete · Next retailer" icon="arrow-forward" onPress={() => navigation.navigate("RepMain", { screen: "Retailers" })} />
        ) : visitAction?.kind === "visit_not_completed" ? (
          <PrimaryButton label="Visit not completed · Open retailer" icon="arrow-forward" onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: order.retailerId })} />
        ) : (
          <Text style={styles.muted}>Visit status unavailable. Refresh before continuing to another retailer.</Text>
        )}
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
  itemRight: { alignItems: "flex-end" },
  itemPrice: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.lg },
  totalLabel: { color: colors.inkMuted, fontSize: 14, fontWeight: "600" },
  totalValue: { color: colors.ink, fontSize: 18, fontWeight: "700" },
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
