import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";

import { useCart } from "../context/CartContext";
import { api, ApiError } from "../api/client";
import { colors, radius, spacing, shadow, inr, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader, QtyStepper, EmptyState } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

export default function CartScreen({ navigation }: any) {
  const { lines, updateQty, clear, total, staleNotice, dismissStaleNotice } = useCart();
  const { t } = useLanguage();
  const [placing, setPlacing] = useState(false);
  const checkoutKey = useRef<string | null>(null);
  const [credit, setCredit] = useState<any>(null);
  const [config, setConfig] = useState<any>({ freeDeliveryThreshold: 0, minOrderValue: 0 });

  // Credit and thresholds are read fresh on focus — an admin may have changed
  // the limit, or another order may have consumed headroom since last visit.
  useFocusEffect(
    useCallback(() => {
      api
        .getHome()
        .then((res) => {
          setCredit(res.credit);
          setConfig(res.config);
        })
        .catch(() => setCredit(null));
    }, [])
  );

  const deliveryFee = total >= (config.freeDeliveryThreshold ?? 0) || total === 0 ? 0 : 250;
  const payable = total + deliveryFee;
  const belowMin = total > 0 && total < (config.minOrderValue ?? 0);
  const overCredit = credit != null && payable > credit.available;
  const canCheckout = lines.length > 0 && !belowMin && !overCredit && !placing;

  const handleCheckout = async () => {
    setPlacing(true);
    try {
      checkoutKey.current ??= `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await api.createOrder(
        lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        checkoutKey.current
      );
      clear();
      checkoutKey.current = null;
      navigation.navigate("OrderConfirmation", { order: res.order });
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        Alert.alert(
          "Credit limit exceeded",
          `This order (${inr(e.body.orderTotal)}) is more than your available credit (${inr(
            e.body.availableCredit
          )}). Reduce quantities or clear some dues first.`
        );
      } else {
        Alert.alert(t("errors.order"), e instanceof ApiError ? e.message : t("errors.generic"));
      }
    } finally {
      setPlacing(false);
    }
  };

  if (lines.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={t("cart.title")} />
        <EmptyState
          icon="cart-outline"
          title={t("cart.emptyTitle")}
          body={t("cart.emptyBody")}
          actionLabel={t("tabs.products")}
          onAction={() => navigation.navigate("Products")}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t("cart.title")}
        subtitle={`${lines.length} line${lines.length === 1 ? "" : "s"}`}
        right={
          <TouchableOpacity onPress={clear}>
            <Text style={styles.clear}>{t("cart.clear")}</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE + 150 }}
        showsVerticalScrollIndicator={false}
      >
        {staleNotice && (
          <TouchableOpacity style={styles.stale} onPress={dismissStaleNotice}>
            <Ionicons name="information-circle" size={16} color="#8A6A12" />
            <Text style={styles.staleText}>{staleNotice}</Text>
            <Ionicons name="close" size={15} color="#8A6A12" />
          </TouchableOpacity>
        )}

        {lines.map((l) => (
          <View key={l.variantId} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{l.productName}</Text>
              <Text style={styles.linePack}>{l.packSize}</Text>
              <Text style={styles.lineRate}>{inr(l.unitPrice)} / case</Text>
            </View>
            <View style={styles.lineRight}>
              <Text style={styles.lineTotal}>{inr(l.unitPrice * l.qty)}</Text>
              <QtyStepper qty={l.qty} onChange={(next) => updateQty(l.variantId, next)} compact />
            </View>
          </View>
        ))}

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{t("cart.summary")}</Text>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t("cart.subtotal")}</Text>
            <Text style={styles.sumValue}>{inr(total)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t("cart.delivery")}</Text>
            <Text style={[styles.sumValue, deliveryFee === 0 && { color: colors.green }]}>
              {deliveryFee === 0 ? "FREE" : inr(deliveryFee)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.sumRow}>
            <Text style={styles.totalLabel}>{t("cart.totalPayable")}</Text>
            <Text style={styles.totalValue}>{inr(payable)}</Text>
          </View>

          {deliveryFee > 0 && (
            <View style={styles.hint}>
              <Feather name="truck" size={13} color={colors.gold} />
              <Text style={styles.hintText}>
                Add {inr((config.freeDeliveryThreshold ?? 0) - total)} more for free delivery
              </Text>
            </View>
          )}
        </View>

        {credit && (
          <View style={styles.creditCard}>
            <View style={styles.between}>
              <Text style={styles.creditLabel}>{t("profile.availableCredit")}</Text>
              <Text style={styles.creditValue}>{inr(credit.available)}</Text>
            </View>
            <View style={styles.creditTrack}>
              <View
                style={[
                  styles.creditFill,
                  {
                    width: `${Math.min(100, (payable / Math.max(credit.available, 1)) * 100)}%`,
                    backgroundColor: overCredit ? colors.danger : colors.green,
                  },
                ]}
              />
            </View>
            <Text style={styles.creditAfter}>
              {overCredit
                ? `Short by ${inr(payable - credit.available)}`
                : `${inr(credit.available - payable)} left after this order`}
            </Text>
          </View>
        )}

        {belowMin && (
          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.warnText}>
              Minimum order value is {inr(config.minOrderValue)}. Add {inr(config.minOrderValue - total)}{" "}
              more to check out.
            </Text>
          </View>
        )}
        {overCredit && (
          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.warnText}>
              This order exceeds your available credit. Clear dues or reduce quantities.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.barLabel}>{t("cart.totalPayable")}</Text>
          <Text style={styles.barValue}>{inr(payable)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkout, !canCheckout && styles.checkoutDisabled]}
          disabled={!canCheckout}
          onPress={handleCheckout}
        >
          {placing ? (
            <ActivityIndicator color={colors.onDark} />
          ) : (
            <>
              <Text style={styles.checkoutText}>{t("cart.placeOrder")}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onDark} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clear: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  stale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  staleText: { flex: 1, fontSize: 12, color: "#8A6A12", fontWeight: "600", lineHeight: 17 },

  line: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  linePack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  lineRate: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  lineRight: { alignItems: "flex-end", gap: spacing.sm },
  lineTotal: { fontSize: 15, fontWeight: "700", color: colors.ink },

  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: spacing.md },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  sumLabel: { fontSize: 13.5, color: colors.inkMuted },
  sumValue: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  totalValue: { fontSize: 18, fontWeight: "700", color: colors.green },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  hintText: { flex: 1, fontSize: 11.5, color: "#8A6A12", fontWeight: "600" },

  creditCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  creditLabel: { fontSize: 13, color: colors.inkMuted },
  creditValue: { fontSize: 15, fontWeight: "700", color: colors.ink },
  creditTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  creditFill: { height: "100%", borderRadius: 3 },
  creditAfter: { fontSize: 11.5, color: colors.inkMuted, marginTop: spacing.sm },

  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17, fontWeight: "600" },

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
    paddingBottom: TAB_BAR_SPACE,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barLabel: { fontSize: 11.5, color: colors.inkMuted },
  barValue: { fontSize: 19, fontWeight: "700", color: colors.ink },
  checkout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  checkoutDisabled: { opacity: 0.4 },
  checkoutText: { color: colors.onDark, fontWeight: "700", fontSize: 14.5 },
});
