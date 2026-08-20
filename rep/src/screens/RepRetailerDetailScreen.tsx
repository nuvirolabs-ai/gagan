import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { colors, radius, spacing, shadow, inr } from "../theme";
import { StatusPill } from "../components/ui";

const LEDGER_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  credit_note: "Credit note",
  payment_reversal: "Payment reversed",
};

export default function RepRetailerDetailScreen({ route, navigation }: any) {
  const { retailerId } = route.params;
  const { setActiveRetailer } = useRep();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      repApi
        .retailer(retailerId)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, [retailerId])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Couldn't load this retailer.</Text>
      </View>
    );
  }

  const { retailer, credit, recentOrders, recentLedger } = data;
  const blocked = credit.available <= 0;

  const startOrder = () => {
    setActiveRetailer(retailer.id);
    navigation.navigate("RepCatalog", { retailerId: retailer.id, retailerName: retailer.name });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {retailer.name
                .split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{retailer.name}</Text>
            <Text style={styles.sub}>{retailer.shopAddress}</Text>
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${retailer.phone}`)}
          >
            <Ionicons name="call" size={17} color={colors.onDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.creditCard}>
          <View style={styles.between}>
            <Text style={styles.creditTitle}>Credit position</Text>
            <View style={styles.tierBadge}>
              <MaterialCommunityIcons name="crown" size={11} color={colors.gold} />
              <Text style={styles.tierText}>{retailer.tier}</Text>
            </View>
          </View>

          <View style={styles.creditRow}>
            <View style={styles.creditCell}>
              <Text style={styles.creditLabel}>Outstanding</Text>
              <Text style={styles.creditBig}>{inr(credit.outstanding)}</Text>
            </View>
            <View style={styles.creditCell}>
              <Text style={styles.creditLabel}>Available</Text>
              <Text style={[styles.creditBig, { color: blocked ? colors.danger : colors.green }]}>
                {inr(credit.available)}
              </Text>
            </View>
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, credit.utilisationPct)}%`,
                  backgroundColor: credit.utilisationPct >= 90 ? colors.danger : colors.green,
                },
              ]}
            />
          </View>
          <Text style={styles.limitLine}>
            {credit.utilisationPct}% of {inr(credit.creditLimit)} limit used
          </Text>

          {credit.overdue > 0 && (
            <View style={styles.warn}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.warnText}>
                {inr(credit.overdue)} is overdue — collect before taking a large order.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Recent orders</Text>
        <View style={styles.card}>
          {recentOrders.length === 0 ? (
            <Text style={styles.muted}>No orders yet.</Text>
          ) : (
            recentOrders.map((o: any, i: number) => (
              <View
                key={o.id}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    GGN-{String(o.orderNo).padStart(5, "0")}
                    {o.placedBy === "rep" ? "  · by you" : ""}
                  </Text>
                  <Text style={styles.rowSub}>
                    {new Date(o.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {o.items.length} item{o.items.length > 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.rowValue}>{inr(Number(o.orderTotal))}</Text>
                  <StatusPill status={o.status} />
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Recent ledger</Text>
        <View style={styles.card}>
          {recentLedger.length === 0 ? (
            <Text style={styles.muted}>No transactions yet.</Text>
          ) : (
            recentLedger.map((e: any, i: number) => (
              <View
                key={e.id}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {LEDGER_LABELS[e.type] ?? "Ledger entry"}
                  </Text>
                  <Text style={styles.rowSub}>
                    {new Date(e.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    {
                      color:
                        (e.direction ? e.direction === "debit" : e.type === "invoice")
                          ? colors.danger
                          : colors.green,
                    },
                  ]}
                >
                  {e.direction ? (e.direction === "debit" ? "+" : "−") : e.type === "invoice" ? "+" : "−"}
                  {inr(Number(e.amount))}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.bar}>
        <TouchableOpacity
          style={[styles.orderBtn, blocked && styles.orderBtnDisabled]}
          disabled={blocked}
          onPress={startOrder}
        >
          <Ionicons name="cart-outline" size={18} color={colors.onDark} />
          <Text style={styles.orderBtnText}>
            {blocked ? "No credit available" : "Place order for this shop"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.inkMuted, fontSize: 13 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800", color: colors.green },
  name: { fontSize: 19, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  creditCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  creditTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tierText: { fontSize: 10.5, fontWeight: "800", color: "#8A6A12" },
  creditRow: { flexDirection: "row", marginTop: spacing.lg },
  creditCell: { flex: 1 },
  creditLabel: { fontSize: 11.5, color: colors.inkMuted },
  creditBig: { fontSize: 19, fontWeight: "700", color: colors.ink, marginTop: 3 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  fill: { height: "100%", borderRadius: 3 },
  limitLine: { fontSize: 11.5, color: colors.inkMuted, marginTop: spacing.sm },
  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnText: { flex: 1, fontSize: 11.5, color: colors.danger, fontWeight: "600", lineHeight: 16 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowSub: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: "700", color: colors.ink },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 15,
  },
  orderBtnDisabled: { opacity: 0.4 },
  orderBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 15 },
});
