import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, inr, spacing } from "../theme";
import type { SalesHomePayload } from "../types/home";

export default function EndDayScreen() {
  const { t } = useLanguage();
  const [home, setHome] = useState<SalesHomePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      repApi.home()
        .then(setHome)
        .catch(() => setHome(null))
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.sky} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>{t("more.endDay")}</Text>
      <Text style={styles.body}>{t("more.endDayHint")}</Text>
      <View style={styles.card}>
        <Row label={t("home.todaysSales")} value={inr(home?.sales.today ?? 0)} />
        <Row label={t("home.visits")} value={String(home?.route.planned ?? 0)} />
        <Row label={t("home.done")} value={String(home?.route.done ?? 0)} />
        <Row label={t("home.coverage")} value={`${home?.route.coveragePct ?? 0}%`} />
      </View>
      <Text style={styles.note}>{t("endDay.honest")}</Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink },
  body: { color: colors.inkMuted, marginTop: 6, marginBottom: spacing.lg, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.inkMuted, fontWeight: "600" },
  value: { color: colors.ink, fontWeight: "800" },
  note: { color: colors.inkMuted, marginTop: spacing.lg, fontSize: 12.5, lineHeight: 18 },
});
