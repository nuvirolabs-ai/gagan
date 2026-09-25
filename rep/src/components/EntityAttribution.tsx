import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLanguage } from "../i18n/LanguageContext";
import { entityAmountsMatchTotal, entityAttributionPresentation, type AttributionStatus, type EntityAmounts } from "../lib/entityAttributionPresentation";
import { colors, inr, spacing } from "../theme";

const LABELS = {
  jainTraders: "finance.jainTraders",
  padamInternational: "finance.padamInternational",
  unattributed: "finance.unattributed",
} as const;

export default function EntityAttribution({
  amounts,
  status,
  expectedTotal,
  overdue,
  expectedOverdue,
  compact = false,
}: {
  amounts?: EntityAmounts | null;
  status?: AttributionStatus | null;
  expectedTotal?: number | null;
  overdue?: EntityAmounts | null;
  expectedOverdue?: number | null;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const presentation = entityAttributionPresentation(amounts, status, expectedTotal);
  const reconciledOverdue = entityAmountsMatchTotal(overdue, expectedOverdue) ? overdue : null;
  if (presentation.rows.length === 0 && !presentation.reviewRequired) return null;

  return (
    <View style={compact ? styles.compact : styles.summary} accessibilityLabel={t("finance.companySplit")}>
      {!compact ? <Text style={styles.heading}>{t("finance.companySplit")}</Text> : null}
      {presentation.rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.labelColumn}>
            <Text style={compact ? styles.compactLabel : styles.label} numberOfLines={1}>
              {t(LABELS[row.key])}
            </Text>
            {!compact && reconciledOverdue && reconciledOverdue[row.key] > 0 ? (
              <Text style={styles.overdue} numberOfLines={1}>
                {inr(reconciledOverdue[row.key])} {t("ledger.overdue")}
              </Text>
            ) : null}
          </View>
          <Text style={compact ? styles.compactAmount : styles.amount} numberOfLines={1}>
            {inr(row.amount)}
          </Text>
        </View>
      ))}
      {presentation.reviewRequired ? <Text style={styles.review}>{t("finance.reviewRequired")}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 5, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  compact: { gap: 2, marginTop: 3, alignSelf: "stretch" },
  heading: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 20 },
  labelColumn: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, color: colors.ink },
  compactLabel: { flexShrink: 1, fontSize: 10, color: colors.textSecondary },
  overdue: { fontSize: 10, color: colors.danger, marginTop: 1 },
  amount: { minWidth: 72, textAlign: "right", fontSize: 12, fontWeight: "700", color: colors.ink },
  compactAmount: { flexShrink: 0, fontSize: 10, fontWeight: "600", color: colors.textSecondary },
  review: { fontSize: 11, fontWeight: "600", color: colors.danger, marginTop: 2 },
});
