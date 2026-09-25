import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AppScreen, EmptyState, ErrorState, SectionHeader } from "../components/ui";
import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import { TeamMember } from "./TeamPerformanceScreen";
import { selectTeamPerformancePresentation } from "./teamPerformancePresentation";

export default function TeamMemberDetailScreen({ route }: any) {
  const { t } = useLanguage();
  const staffId = route.params?.staffId;
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (typeof staffId !== "string") { setFailed(true); return; }
    try {
      setData(await repApi.salesLeader(staffId));
      setFailed(false);
    } catch { setFailed(true); }
  }, [staffId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !data) return <AppScreen style={styles.center}><ActivityIndicator color={colors.blue} /></AppScreen>;
  if (failed && !data) return <AppScreen style={styles.center}><ErrorState title={t("team.error")} actionLabel={t("team.refresh")} onAction={() => void refresh()} /></AppScreen>;
  const member = data?.members?.find((item: any) => item.salespersonId === staffId);
  if (!member) return <AppScreen style={styles.center}><EmptyState icon="person-outline" title={t("team.members")} body={t("team.noReports")} /></AppScreen>;
  const presentation = selectTeamPerformancePresentation(data, t);
  const index = data.members.findIndex((item: any) => item.salespersonId === staffId);
  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        {failed ? <ErrorState title={t("team.error")} actionLabel={t("team.refresh")} onAction={() => void refresh()} /> : null}
        <SectionHeader title={member.name} />
        <TeamMember member={member} presentation={presentation.members[index]} t={t} />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", padding: spacing.xl },
  content: { padding: spacing.xl, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP, gap: spacing.md },
});
