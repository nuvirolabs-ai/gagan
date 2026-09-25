import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SectionHeader, TextButton } from "../components/ui";
import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, inr, spacing } from "../theme";
import { teamTargetConfigured } from "./teamPerformancePresentation";

export default function TeamTodaySection({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await repApi.salesLeader());
      setFailed(false);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const actual = Number(data?.team?.actual ?? 0);
  const target = data?.team?.target;
  const configured = teamTargetConfigured(data);
  const pct = configured && target > 0 ? data?.team?.completionPct : null;

  return (
    <View style={styles.section}>
      <SectionHeader title={t("team.today")} action={<TextButton label={t("team.title")} onPress={onOpen} />} />
      {loading && !data ? <ActivityIndicator color={colors.blue} /> : null}
      {failed && !data ? <TextButton label={t("team.refresh")} onPress={() => void load()} /> : null}
      {data ? (
        <View style={styles.row}>
          <View style={styles.metric}><Text style={styles.label}>{t("team.actual")}</Text><Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{inr(actual)}</Text></View>
          <View style={styles.metric}><Text style={styles.label}>{t("team.target")}</Text><Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{configured ? inr(Number(target)) : "—"}</Text></View>
          <View style={styles.metric}><Text style={styles.label}>{t("team.salespeople")}</Text><Text style={styles.value}>{data.team.salespeople}</Text></View>
          {pct != null ? <Text style={styles.pct}>{pct}%</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.separator, paddingTop: spacing.md },
  metric: { flex: 1, minWidth: 80 },
  label: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
  value: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: "700", fontVariant: ["tabular-nums"] },
  pct: { color: colors.green, fontSize: 13, fontWeight: "700" },
});
