import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { colors, radius, spacing, shadow, inr } from "../theme";
import { StatusPill, OrderTimeline, EmptyState } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { formatOrderRef } from "../lib/orderRef";

const POD_LABEL: Record<string, string> = {
  photo: "Photo",
  otp: "OTP",
  signature: "Signature",
};

export default function OrderDetailScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { addLine } = useCart();
  const { t } = useLanguage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getOrder(orderId);
      setOrder(res.order);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="alert-circle-outline"
          title={t("orders.loadError")}
          body={t("errors.checkConnection")}
          actionLabel={t("common.retry")}
          onAction={() => void load()}
        />
      </View>
    );
  }

  const reorder = () => {
    order.items.forEach((item: any) => {
      addLine({
        variantId: item.variantId,
        productName: item.variant?.product.name ?? "Item",
        packSize: item.variant ? `${item.variant.unitSize} × ${item.variant.unitsPerCase}` : "",
        unitPrice: Number(item.unitPrice),
        qty: item.qtyOrdered,
      });
    });
    navigation.navigate("Main", { screen: "Cart" });
  };

  const isActive = ["placed", "confirmed", "packed", "out_for_delivery"].includes(order.status);
  const invoice = order.invoice;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{formatOrderRef(order)}</Text>
          <Text style={styles.date}>
            Placed{" "}
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            ·{" "}
            {new Date(order.createdAt).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <StatusPill status={order.status} />
      </View>

      {(isActive || order.status === "delivered") && (
        <View style={styles.card}>
          <OrderTimeline status={order.status} />
        </View>
      )}

      <Text style={styles.sectionTitle}>{t("orders.items")}</Text>
      <View style={styles.card}>
        {order.items.map((item: any, i: number) => {
          const short =
            item.weightDelivered != null &&
            item.variant &&
            Number(item.weightDelivered) <
              item.variant.unitWeightKg * item.variant.unitsPerCase * item.qtyOrdered;
          return (
            <View
              key={item.id}
              style={[styles.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.variant?.product.name}</Text>
                <Text style={styles.itemPack}>
                  {item.variant?.unitSize} × {item.variant?.unitsPerCase} · {inr(Number(item.unitPrice))}/case
                </Text>
                {item.weightDelivered != null && (
                  <Text style={[styles.itemWeight, short && { color: colors.danger }]}>
                    {t("orders.deliveredWeight", { weight: Number(item.weightDelivered) })}
                    {short ? ` ${t("orders.short")}` : ""}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.itemQty}>× {item.qtyOrdered}</Text>
                <Text style={styles.itemTotal}>
                  {inr(Number(item.unitPrice) * item.qtyOrdered)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{t("orders.payment")}</Text>
      <View style={styles.card}>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>{t("orders.orderedValue")}</Text>
          <Text style={styles.sumValue}>{inr(Number(order.orderTotal))}</Text>
        </View>
        {invoice ? (
          <>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t("orders.invoicedWeight")}</Text>
              <Text style={[styles.sumValue, { fontWeight: "700" }]}>{inr(invoice.amount)}</Text>
            </View>
            {Math.abs(invoice.variance) >= 1 && (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>{t("orders.variance")}</Text>
                <Text
                  style={[
                    styles.sumValue,
                    { color: invoice.variance < 0 ? colors.green : colors.danger },
                  ]}
                >
                  {invoice.variance < 0 ? "−" : "+"}
                  {inr(Math.abs(invoice.variance))}
                </Text>
              </View>
            )}
            <View style={styles.noteBox}>
              <MaterialCommunityIcons name="scale-balance" size={15} color={colors.green} />
              <Text style={styles.noteText}>
                {t("orders.itemsWeightNote")}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.noteBox}>
            <Ionicons name="information-circle-outline" size={15} color={colors.green} />
            <Text style={styles.noteText}>
              {t("orders.deliveryNote")}
            </Text>
          </View>
        )}
      </View>

      {order.delivery && (
        <>
          <Text style={styles.sectionTitle}>{t("orders.delivery")}</Text>
          <View style={styles.card}>
            {order.delivery.routeId && (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>{t("orders.route")}</Text>
                <Text style={styles.sumValue}>{order.delivery.routeId}</Text>
              </View>
            )}
            {order.delivery.podType && (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>{t("orders.proofOfDelivery")}</Text>
                <Text style={styles.sumValue}>{POD_LABEL[order.delivery.podType]}</Text>
              </View>
            )}
            {order.delivery.actualWeight != null && (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>{t("orders.totalWeight")}</Text>
                <Text style={styles.sumValue}>{Number(order.delivery.actualWeight)}kg</Text>
              </View>
            )}
            {order.delivery.podCapturedAt && (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>{t("orders.deliveredAt")}</Text>
                <Text style={styles.sumValue}>
                  {new Date(order.delivery.podCapturedAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.reorderBtn} onPress={reorder}>
        <MaterialCommunityIcons name="refresh" size={17} color={colors.onDark} />
        <Text style={styles.reorderText}>{t("orders.reorderItems")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.inkMuted },

  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.lg },
  orderId: { fontSize: 21, fontWeight: "700", color: colors.ink },
  date: { fontSize: 12, color: colors.inkMuted, marginTop: 3 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  itemRow: { flexDirection: "row", paddingVertical: spacing.md, gap: spacing.md },
  itemName: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  itemPack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  itemWeight: { fontSize: 11.5, color: colors.greenMid, marginTop: 3, fontWeight: "600" },
  itemQty: { fontSize: 13, color: colors.inkMuted },
  itemTotal: { fontSize: 14.5, fontWeight: "700", color: colors.ink, marginTop: 3 },

  sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  sumLabel: { fontSize: 13, color: colors.inkMuted, flex: 1 },
  sumValue: { fontSize: 13.5, fontWeight: "600", color: colors.ink },

  noteBox: {
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: { flex: 1, fontSize: 11.5, color: colors.ink, lineHeight: 16.5 },

  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 15,
    marginTop: spacing.xl,
  },
  reorderText: { color: colors.onDark, fontWeight: "700", fontSize: 15 },
});
