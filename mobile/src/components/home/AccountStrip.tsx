import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";

import type { AccountModel } from "../../lib/homePresentation";
import { colors, radius, spacing, inr } from "../../theme";
import { useLanguage } from "../../i18n/LanguageContext";

export default function AccountStrip({
  account,
  onPay,
  onLedger,
}: {
  account: AccountModel;
  onPay: () => void;
  onLedger: () => void;
}) {
  const { t } = useLanguage();
  const narrow = useWindowDimensions().width < 360;

  if (account.kind === "unavailable") {
    return (
      <View style={styles.band} accessibilityLabel={t("home.accountUnavailable")}>
        <Text style={styles.quiet}>{t("home.accountUnavailable")}</Text>
        <TouchableOpacity onPress={onLedger} accessibilityRole="button">
          <Text style={styles.link}>{t("home.ledger")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (account.kind === "clear") {
    return (
      <View style={styles.band} accessibilityLabel={t("home.allClear")}>
        <View style={{ flex: 1 }}>
          <Text style={styles.clearTitle}>{t("home.allClear")}</Text>
          <Text style={styles.clearBody}>{t("home.noPaymentDue")}</Text>
        </View>
        <TouchableOpacity onPress={onLedger} accessibilityRole="button">
          <Text style={styles.link}>{t("home.ledger")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cells = [
    { label: t("home.outstanding"), value: account.outstanding ?? 0, tone: "ink" as const },
    { label: t("home.overdue"), value: account.overdue ?? 0, tone: (account.overdue ?? 0) > 0 ? "overdue" : "muted" as const },
    { label: t("home.availableCredit"), value: account.available ?? 0, tone: "muted" as const },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {cells.map((cell, i) => (
          <View key={cell.label} style={[styles.cell, i > 0 && styles.cellBorder]}>
            <Text style={styles.label} numberOfLines={1}>
              {cell.label}
            </Text>
            <Text
              style={[
                styles.value,
                narrow && styles.valueNarrow,
                cell.tone === "overdue" && styles.valueOverdue,
                cell.tone === "muted" && styles.valueMuted,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {inr(cell.value)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.pay} onPress={onPay} accessibilityRole="button" accessibilityLabel={t("home.pay")}>
          <Text style={styles.payText}>{t("home.pay")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ledger} onPress={onLedger} accessibilityRole="button">
          <Text style={styles.ledgerText}>{t("home.ledger")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  cell: { flex: 1, paddingRight: spacing.sm },
  cellBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.inkMuted,
    letterSpacing: 0.2,
  },
  value: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 4 },
  valueNarrow: { fontSize: 14 },
  valueOverdue: { color: colors.error },
  valueMuted: { color: colors.ink },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  pay: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  payText: { color: colors.onDark, fontWeight: "700", fontSize: 13.5 },
  ledger: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
    minHeight: 40,
    justifyContent: "center",
  },
  ledgerText: { color: colors.green, fontWeight: "700", fontSize: 13.5 },
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quiet: { flex: 1, fontSize: 13, color: colors.inkMuted, fontWeight: "600" },
  clearTitle: { fontSize: 14, fontWeight: "700", color: colors.green },
  clearBody: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  link: { fontSize: 13, fontWeight: "700", color: colors.green },
});
