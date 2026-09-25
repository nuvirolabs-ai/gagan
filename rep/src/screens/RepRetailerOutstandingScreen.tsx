import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { repApi } from "../api/repClient";
import EntityAttribution from "../components/EntityAttribution";
import { AppScreen, ErrorState, SectionHeader, Skeleton, Surface, TextButton } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import type { AttributionStatus, EntityAmounts } from "../lib/entityAttributionPresentation";
import { colors, inr, spacing } from "../theme";

const LEDGER_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  credit_note: "Credit note",
  payment_reversal: "Payment reversed",
};

type FinanceSummary = {
  outstanding: number;
  overdue: number;
  creditLimit: number;
  availableCredit: number;
  isStale: boolean;
  entityBalances?: {
    outstanding?: EntityAmounts;
    overdue?: EntityAmounts;
    attributionStatus?: AttributionStatus;
  };
};

type LedgerEntry = {
  id: string;
  sequence: string;
  type: string;
  direction: "debit" | "credit";
  amount: number;
  balanceAfter: number;
  createdAt: string;
  invoice?: { invoiceNumber: number } | null;
  order?: { orderNo: number } | null;
  paymentAllocations?: Array<{
    invoice: { invoiceNumber: number; orderNo: number | null };
  }>;
  entityBreakdown?: EntityAmounts & { attributionStatus: AttributionStatus };
  reason?: string | null;
};

export default function RepRetailerOutstandingScreen({ route }: any) {
  const { retailerId, retailerName } = route.params;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setSummary(null);
    setEntries([]);
    setNextCursor(null);
    try {
      const page = await repApi.retailerLedger(retailerId);
      setSummary(page.financialSummary);
      setEntries(page.entries ?? []);
      setNextCursor(page.nextCursor ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage])
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await repApi.retailerLedger(retailerId, nextCursor);
      setEntries((current) => [...current, ...(page.entries ?? [])]);
      setNextCursor(page.nextCursor ?? null);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, retailerId]);

  if (loading && !summary) {
    return (
      <AppScreen>
        <View style={styles.content}>
          <Skeleton height={120} radius={12} />
          <Skeleton height={72} radius={8} />
          <Skeleton height={72} radius={8} />
        </View>
      </AppScreen>
    );
  }

  if (!summary && loadError) {
    return (
      <AppScreen>
        <View style={styles.content}>
          <ErrorState
            title={t("errors.generic")}
            body={t("retailer.ledgerLoadFailed")}
            actionLabel={t("common.retry")}
            onAction={() => void loadFirstPage()}
          />
        </View>
      </AppScreen>
    );
  }

  if (!summary) return null;

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.retailerName}>{retailerName}</Text>
        <Surface>
          <View style={styles.outstandingRow}>
            <View style={styles.grow}>
              <Text style={styles.outstandingLabel}>{t("profile.outstanding")}</Text>
              <Text style={styles.outstandingValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {inr(summary.outstanding)}
              </Text>
            </View>
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{t("retailer.overdue")}</Text>
              <Text style={styles.metricValue}>{inr(summary.overdue)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{t("profile.availableCredit")}</Text>
              <Text style={styles.metricValue}>{inr(summary.availableCredit)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{t("retailer.creditLimit")}</Text>
              <Text style={styles.metricValue}>{inr(summary.creditLimit)}</Text>
            </View>
          </View>
          <EntityAttribution
            amounts={summary.entityBalances?.outstanding}
            overdue={summary.entityBalances?.overdue}
            expectedOverdue={summary.overdue}
            status={summary.entityBalances?.attributionStatus}
            expectedTotal={summary.outstanding}
          />
          {summary.isStale ? <Text style={styles.stale}>{t("retailer.accountDataStale")}</Text> : null}
        </Surface>

        <View>
          <SectionHeader title={t("retailer.fullLedger")} />
          {entries.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noTransactions")}</Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <View style={styles.entryMain}>
                  <Text style={styles.entryTitle}>{LEDGER_LABELS[entry.type] ?? "Ledger entry"}</Text>
                  <Text style={styles.entryMeta}>
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                  {entry.invoice ? (
                    <Text style={styles.entryMeta}>
                      {t("retailer.invoiceRef", { number: entry.invoice.invoiceNumber })}
                      {entry.order ? ` · ${t("retailer.orderRef", { number: entry.order.orderNo })}` : ""}
                    </Text>
                  ) : null}
                  {entry.paymentAllocations?.map((allocation, index) => (
                    <Text key={`${entry.id}-${index}`} style={styles.entryMeta}>
                      {t("retailer.invoiceRef", { number: allocation.invoice.invoiceNumber })}
                      {allocation.invoice.orderNo != null ? ` · ${t("retailer.orderRef", { number: allocation.invoice.orderNo })}` : ""}
                    </Text>
                  ))}
                  {entry.reason ? <Text style={styles.entryMeta}>{entry.reason}</Text> : null}
                  <EntityAttribution
                    amounts={entry.entityBreakdown}
                    status={entry.entityBreakdown?.attributionStatus}
                    expectedTotal={entry.amount}
                    compact
                  />
                </View>
                <View style={styles.entryAmounts}>
                  <Text style={[styles.entryValue, entry.direction === "debit" ? styles.debit : styles.credit]}>
                    {entry.direction === "debit" ? "+" : "−"}{inr(entry.amount)}
                  </Text>
                  <Text style={styles.entryMeta}>{t("retailer.balanceAfter")} {inr(entry.balanceAfter)}</Text>
                </View>
              </View>
            ))
          )}
          {loadMoreError ? (
            <ErrorState
              title={t("errors.generic")}
              actionLabel={t("common.retry")}
              onAction={() => void loadMore()}
            />
          ) : null}
          {nextCursor && !loadMoreError ? (
            <TextButton
              label={loadingMore ? t("retailer.loadingMore") : t("retailer.loadMore")}
              disabled={loadingMore}
              onPress={() => void loadMore()}
            />
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.section },
  retailerName: { fontSize: 18, fontWeight: "700", color: colors.ink },
  outstandingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1, minWidth: 0 },
  outstandingLabel: { fontSize: 12, color: colors.textSecondary },
  outstandingValue: { marginTop: 4, fontSize: 28, fontWeight: "700", color: colors.ink },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  metric: { minWidth: "28%", flexGrow: 1, gap: 3 },
  metricLabel: { fontSize: 11, color: colors.textSecondary },
  metricValue: { fontSize: 13, fontWeight: "700", color: colors.ink },
  stale: { marginTop: spacing.md, fontSize: 11, color: colors.warning, lineHeight: 16 },
  muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  entry: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  entryMain: { flex: 1, minWidth: 0, gap: 3 },
  entryTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  entryMeta: { fontSize: 11, color: colors.textSecondary },
  entryAmounts: { maxWidth: 118, alignItems: "flex-end", gap: 4 },
  entryValue: { fontSize: 13, fontWeight: "700" },
  debit: { color: colors.danger },
  credit: { color: colors.primary },
});
