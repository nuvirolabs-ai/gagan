import React, { useCallback, useState } from "react";
import { View, Text, SectionList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, shadow, inr } from "../theme";
import { EmptyState } from "../components/ui";

interface Entry {
  id: string;
  type: "invoice" | "payment";
  amount: string;
  balanceAfter: string;
  createdAt: string;
}

export default function LedgerScreen() {
  const { retailer } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState({ balance: "0", limit: "0" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!retailer?.id) return;
    const res = await api.getLedger(retailer.id);
    setEntries(res.entries);
    setSummary({ balance: res.currentBalance, limit: res.creditLimit });
  }, [retailer?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  // Group by month so a long history stays scannable.
  const sections = React.useMemo(() => {
    const buckets = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = new Date(e.createdAt).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(e);
    }
    return [...buckets.entries()].map(([title, data]) => ({ title, data }));
  }, [entries]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const balance = Number(summary.balance);
  const limit = Number(summary.limit);

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Outstanding balance</Text>
        <Text style={styles.heroValue}>{inr(balance)}</Text>
        <View style={styles.heroTrack}>
          <View
            style={[
              styles.heroFill,
              { width: `${limit > 0 ? Math.min(100, (balance / limit) * 100) : 0}%` },
            ]}
          />
        </View>
        <View style={styles.heroRow}>
          <Text style={styles.heroSub}>Limit {inr(limit)}</Text>
          <Text style={styles.heroSub}>Available {inr(Math.max(limit - balance, 0))}</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="file-document-outline"
            title="No transactions yet"
            body="Invoices appear here once an order is delivered, and payments once they're recorded."
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const isInvoice = item.type === "invoice";
          return (
            <View style={styles.entry}>
              <View style={[styles.entryIcon, isInvoice ? styles.iconInvoice : styles.iconPayment]}>
                <MaterialCommunityIcons
                  name={isInvoice ? "file-document-outline" : "cash-check"}
                  size={17}
                  color={isInvoice ? "#8A6A12" : colors.green}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryType}>{isInvoice ? "Invoice" : "Payment received"}</Text>
                <Text style={styles.entryDate}>
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[styles.entryAmount, { color: isInvoice ? colors.danger : colors.green }]}
                >
                  {isInvoice ? "+" : "−"}
                  {inr(Number(item.amount))}
                </Text>
                <Text style={styles.entryBalance}>Bal {inr(Number(item.balanceAfter))}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },

  hero: {
    backgroundColor: colors.greenDeep,
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  heroLabel: { color: colors.onDarkMuted, fontSize: 12.5 },
  heroValue: { color: colors.onDark, fontSize: 30, fontWeight: "700", marginTop: 4 },
  heroTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  heroFill: { height: "100%", backgroundColor: colors.gold, borderRadius: 3 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  heroSub: { color: colors.onDarkMuted, fontSize: 11.5 },

  sectionHeader: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  entryIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInvoice: { backgroundColor: colors.goldSoft },
  iconPayment: { backgroundColor: colors.greenSoft },
  entryType: { fontSize: 14, fontWeight: "700", color: colors.ink },
  entryDate: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  entryAmount: { fontSize: 15, fontWeight: "700" },
  entryBalance: { fontSize: 10.5, color: colors.inkMuted, marginTop: 2 },
});
