import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  AppScreen,
  EmptyState,
  ErrorState,
  MetricStrip,
  ProgressRow,
  SectionHeader,
  StatusChip,
  Surface,
} from "../components/ui";
import { repApi } from "../api/repClient";
import { colors, inr, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import { useLanguage } from "../i18n/LanguageContext";

function riskMeta(level: string, t: (key: string) => string) {
  if (level === "at_risk") return { label: t("team.atRisk"), tone: "danger" as const };
  if (level === "watch") return { label: t("team.watch"), tone: "warning" as const };
  return { label: t("team.onTrack"), tone: "green" as const };
}

function TeamMember({ member, t }: { member: any; t: (key: string) => string }) {
  const target = member.headlineTarget;
  const risk = riskMeta(member.risk?.level ?? "on_track", t);
  const attendance = member.attendance === "present";
  const route = member.route;

  return (
    <Surface level={1}>
      <View style={styles.memberHeading}>
        <View style={styles.memberIdentity}>
          <Text style={styles.memberName} numberOfLines={2}>{member.name}</Text>
          <Text style={styles.memberMeta} numberOfLines={1}>
            {[member.territory, member.rank ? `#${member.rank}` : null].filter(Boolean).join(" | ") || " "}
          </Text>
        </View>
        <StatusChip label={risk.label} tone={risk.tone} />
      </View>

      {target ? (
        <View style={styles.memberTarget}>
          <View style={styles.between}>
            <Text style={styles.memberMeta}>{inr(target.actual)} / {inr(target.target)}</Text>
            <Text style={styles.memberMeta}>{target.completionPct}%</Text>
          </View>
          <ProgressRow pct={target.completionPct} tone={risk.tone === "danger" ? "danger" : "green"} />
          {member.projection?.projected != null ? (
            <Text style={styles.memberMeta}>{t("team.projected")}: {inr(member.projection.projected)}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.memberMeta}>{t("team.noTarget")}</Text>
      )}

      <View style={styles.memberFooter}>
        <StatusChip label={attendance ? t("team.present") : t("team.absent")} tone={attendance ? "green" : "neutral"} />
        {route ? (
          <Text style={styles.memberMeta}>
            {t("team.route")}: {route.visited}/{route.total} {t("team.stops")} | {route.completionPct}%
          </Text>
        ) : <Text style={styles.memberMeta}>{t("team.noRoute")}</Text>}
      </View>
      {member.risk?.reasons?.[0] ? <Text style={styles.reason}>{member.risk.reasons[0]}</Text> : null}
    </Surface>
  );
}

export default function TeamPerformanceScreen() {
  const { t } = useLanguage();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await repApi.salesLeader());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !data) {
    return <AppScreen style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></AppScreen>;
  }

  if (failed && !data) {
    return (
      <AppScreen style={styles.errorScreen}>
        <ErrorState title={t("team.error")} actionLabel={t("team.refresh")} onAction={() => void refresh()} />
      </AppScreen>
    );
  }

  const team = data?.team;
  const members: any[] = data?.members ?? [];
  const actions: any[] = data?.recommendedActions ?? [];
  const target = Number(team?.target ?? 0);
  const actual = Number(team?.actual ?? 0);
  const projection = team?.projection?.projected;
  const targetPct = Number(team?.completionPct ?? 0);
  const dateLabel = data?.period ? `${data.period.from} to ${data.period.to}` : "";

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {failed ? <ErrorState title={t("team.error")} actionLabel={t("team.refresh")} onAction={() => void refresh()} /> : null}
        {dateLabel ? <Text style={styles.period}>{dateLabel}</Text> : null}

        <Surface>
          <SectionHeader title={t("team.target")} />
          {target > 0 ? (
            <>
              <Text style={styles.mainValue}>{inr(actual)} <Text style={styles.targetValue}>/ {inr(target)}</Text></Text>
              <Text style={styles.meta}>{t("team.actual")} | {targetPct}%</Text>
              <View style={styles.progress}><ProgressRow pct={targetPct} tone="green" /></View>
            </>
          ) : <Text style={styles.meta}>{t("team.noTarget")}</Text>}
          <View style={styles.summaryRows}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t("team.projected")}</Text>
              <Text style={styles.summaryValue}>{projection == null ? "-" : inr(projection)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t("team.sellingDays")}</Text>
              <Text style={styles.summaryValue}>{data?.sellingDays?.elapsed ?? 0} / {data?.sellingDays?.total ?? 0}</Text>
            </View>
          </View>
          {data?.targets?.uncascaded > 0 ? (
            <Text style={styles.meta}>
              {t("team.memberTargets")}: {inr(data.targets.rollup)} | {t("team.uncascaded")}: {inr(data.targets.uncascaded)}
            </Text>
          ) : null}
        </Surface>

        <Surface>
          <MetricStrip
            bare
            items={[
              { label: t("team.presentToday"), value: `${team?.present ?? 0} / ${team?.salespeople ?? 0}` },
              { label: t("team.visits"), value: String(team?.visits ?? 0) },
              { label: t("team.orders"), value: String(team?.orders ?? 0) },
              { label: t("team.collections"), value: inr(Number(team?.collections ?? 0)) },
            ]}
          />
        </Surface>

        {members.length === 0 ? (
          <EmptyState icon="people-outline" title={t("team.members")} body={t("team.noReports")} />
        ) : (
          <View style={styles.section}>
            <SectionHeader title={t("team.members")} />
            {members.map((member) => <TeamMember key={member.salespersonId} member={member} t={t} />)}
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title={t("team.actions")} />
          {actions.length === 0 ? (
            <Surface level={1}><Text style={styles.meta}>{t("team.noActions")}</Text></Surface>
          ) : actions.map((action, index) => (
            <Surface level={1} key={`${action.type}-${action.salespersonId}-${index}`}>
              <View style={styles.actionHeading}>
                <Text style={styles.actionTitle} numberOfLines={2}>{action.action}</Text>
                <StatusChip label={action.salespersonName} tone="neutral" />
              </View>
              <Text style={styles.meta}>{action.why}</Text>
            </Surface>
          ))}
        </View>
        <Text style={styles.languageNote}>{t("team.projectionNote")}</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  errorScreen: { padding: spacing.xl, justifyContent: "center" },
  content: { padding: spacing.xl, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP, gap: spacing.lg },
  period: { color: colors.textSecondary, fontSize: 12 },
  section: { gap: spacing.md },
  mainValue: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "700", fontVariant: ["tabular-nums"] },
  targetValue: { color: colors.inkMuted, fontSize: 16, fontWeight: "500" },
  meta: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  progress: { marginTop: spacing.sm, marginBottom: spacing.md },
  summaryRows: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  summaryItem: { flex: 1, minWidth: 0, gap: spacing.xs },
  summaryLabel: { color: colors.textSecondary, fontSize: 12 },
  summaryValue: { color: colors.ink, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  memberHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  memberIdentity: { flex: 1, minWidth: 0, gap: spacing.xs },
  memberName: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "600" },
  memberMeta: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  memberTarget: { gap: spacing.sm, marginTop: spacing.md },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  memberFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  reason: { color: colors.warning, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  actionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.sm },
  actionTitle: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  languageNote: { color: colors.textTertiary, fontSize: 11, lineHeight: 16 },
});
