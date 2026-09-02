import React, { useCallback, useState } from "react";
import { View, Text, SectionList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, inr } from "../theme";
import { EmptyState, ScreenSkeleton } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

interface Entry {
  id: string;
  type: "invoice" | "payment" | "credit_note" | "payment_reversal";
  direction: "debit" | "credit";
  amount: string | number;
  balanceAfter: string | number;
  createdAt: string;
}

export default function LedgerScreen() {
  const { retailer } = useAuth();
  const { t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState({ balance: "0", limit: "0" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!retailer?.id) return;
    const res = await api.getLedger(retailer.id);
    setEntries(res.entries);
    setSummary({ balance: res.currentBalance, limit: res.creditLimit });
    setLoadError(false);
  }, [retailer?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setEntries([]);
          setLoadError(true);
        })
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => setLoadError(true));
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
        <ScreenSkeleton rows={6} />
      </View>
    );
  }

  const balance = Number(summary.balance);
  const limit = Number(summary.limit);

  return (
    <View style={styles.screen}>
      <View style={styles.strip} accessibilityLabel={t("ledger.outstanding")}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel} numberOfLines={1}>
            {t("ledger.outstanding")}
          </Text>
          <Text
            style={styles.cellValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {inr(balance)}
          </Text>
        </View>
        <View style={[styles.cell, styles.cellBorder]}>
          <Text style={styles.cellLabel} numberOfLines={1}>
            {t("ledger.available")}
          </Text>
          <Text
            style={styles.cellValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {inr(Math.max(limit - balance, 0))}
          </Text>
        </View>
      </View>
      <Text style={styles.limitCue}>{t("ledger.limit", { amount: inr(limit) })}</Text>

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
            icon={loadError ? "alert-circle-outline" : "file-document-outline"}
            title={loadError ? t("ledger.loadError") : t("ledger.noTransactions")}
            body={loadError ? t("errors.checkConnection") : t("ledger.noTransactionsBody")}
            actionLabel={loadError ? t("common.retry") : undefined}
            onAction={loadError ? () => void load() : undefined}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const isDebit = item.direction ? item.direction === "debit" : item.type === "invoice";
          const label = {
            invoice: t("ledger.invoice"),
            payment: t("ledger.paymentReceived"),
            credit_note: t("ledger.creditNote"),
            payment_reversal: t("ledger.paymentReversed"),
          }[item.type];
          return (
            <View style={styles.entry}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.entryType} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.entryDate}>
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
                <Text
                  style={[styles.entryAmount, { color: isDebit ? colors.danger : colors.green }]}
                >
                  {isDebit ? "+" : "−"}
                  {inr(Number(item.amount))}
                </Text>
                <Text style={styles.entryBalance}>{t("ledger.balance", { amount: inr(Number(item.balanceAfter)) })}</Text>
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
  center: { flex: 1, backgroundColor: colors.bg },

  strip: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cell: { flex: 1, paddingRight: spacing.sm },
  cellBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  cellLabel: { fontSize: 10.5, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.2 },
  cellValue: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 4 },
  limitCue: {
    fontSize: 12.5,
    color: colors.inkMuted,
    fontWeight: "600",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  entryType: { fontSize: 14, fontWeight: "700", color: colors.ink },
  entryDate: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  entryAmount: { fontSize: 15, fontWeight: "700" },
  entryBalance: { fontSize: 10.5, color: colors.inkMuted, marginTop: 2 },
});
