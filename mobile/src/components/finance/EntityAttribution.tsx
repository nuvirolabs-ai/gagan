import React from "react";
import { Text, View, StyleSheet } from "react-native";

import type { EntityAttributionRow } from "../../lib/homePresentation";
import type { FinancialAttributionStatus } from "../../types";
import { colors, spacing, inr } from "../../theme";
import { useLanguage } from "../../i18n/LanguageContext";

const LABELS: Record<EntityAttributionRow["key"], string> = {
  jainTraders: "finance.jainTraders",
  padamInternational: "finance.padamInternational",
  unattributed: "finance.unattributed",
};

export default function EntityAttribution({
  rows,
  status,
  variant = "summary",
}: {
  rows: EntityAttributionRow[];
  status: FinancialAttributionStatus | null;
  variant?: "summary" | "inline";
}) {
  const { t } = useLanguage();
  if (rows.length === 0 && status !== "review_required") return null;

  if (variant === "inline") {
    return (
      <View style={styles.inline} accessibilityLabel={t("finance.companySplit")}>
        {rows.map((row) => (
          <Text key={row.key} style={styles.inlineItem} numberOfLines={1}>
            {t(LABELS[row.key])} {inr(row.outstanding)}
          </Text>
        ))}
        {status === "review_required" ? (
          <Text style={styles.reviewInline}>{t("finance.reviewRequired")}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.summary} accessibilityLabel={t("finance.companySplit")}>
      <Text style={styles.heading}>{t("finance.companySplit")}</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.labelColumn}>
            <Text style={styles.label} numberOfLines={1}>{t(LABELS[row.key])}</Text>
            {row.overdue > 0 ? (
              <Text style={styles.overdue} numberOfLines={1}>
                {t("finance.overdueAmount", { amount: inr(row.overdue) })}
              </Text>
            ) : null}
          </View>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {inr(row.outstanding)}
          </Text>
        </View>
      ))}
      {status === "review_required" ? (
        <Text style={styles.review}>{t("finance.reviewRequired")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 5, marginTop: spacing.sm },
  heading: { fontSize: 10.5, fontWeight: "700", color: colors.inkMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 22 },
  labelColumn: { flex: 1, minWidth: 0 },
  label: { fontSize: 11.5, color: colors.ink },
  overdue: { fontSize: 9.5, color: colors.error, marginTop: 1 },
  amount: { minWidth: 74, textAlign: "right", fontSize: 11.5, fontWeight: "700", color: colors.ink },
  review: { fontSize: 10, fontWeight: "600", color: colors.error, marginTop: 2 },
  inline: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.sm, rowGap: 2, marginTop: 3 },
  inlineItem: { maxWidth: "100%", fontSize: 9.5, color: colors.inkMuted },
  reviewInline: { fontSize: 9.5, fontWeight: "600", color: colors.error },
});
