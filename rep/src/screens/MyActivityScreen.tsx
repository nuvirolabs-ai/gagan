import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  AppScreen,
  EmptyState,
  FilterChip,
  MetricStrip,
  ProgressRow,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  StatusChip,
  Surface,
  TimelineEvent,
} from "../components/ui";
import { ACTIVITY_LABELS } from "../components/ActivityComposer";
import { AchievementLine } from "../components/Achievement";
import { repApi } from "../api/repClient";
import { colors, inr, spacing, TAB_BAR_SPACE } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const KIND_META: Record<string, { icon: string; label: string }> = {
  workday_started: { icon: "play-circle-outline", label: "Day started" },
  workday_ended: { icon: "stop-circle-outline", label: "Day ended" },
  visit: { icon: "location-outline", label: "Visit" },
  activity: { icon: "clipboard-outline", label: "Activity" },
  order: { icon: "cart-outline", label: "Order" },
  collection: { icon: "wallet-outline", label: "Collection" },
  task_completed: { icon: "checkmark-circle-outline", label: "Task" },
  expense: { icon: "receipt-outline", label: "Expense" },
  service_issue: { icon: "alert-circle-outline", label: "Issue" },
};

const OUTCOME_LABELS: Record<string, string> = {
  order_placed: "Order placed",
  no_order: "No order",
  payment_collected: "Payment collected",
  follow_up_required: "Follow-up needed",
  issue_raised: "Issue raised",
  shop_closed: "Shop closed",
  decision_maker_unavailable: "Owner unavailable",
  other: "Other",
  VERIFIED: "Verified",
  NEEDS_REVIEW: "Needs review",
  OUTSIDE_STORE_AREA: "Outside store area",
  STORE_LOCATION_NOT_AVAILABLE: "No store location",
  LOW_GPS_ACCURACY: "Weak GPS",
};

function humanise(detail: string | null): string | null {
  if (!detail) return null;
  return detail
    .split(" · ")
    .map((part) => OUTCOME_LABELS[part] ?? ACTIVITY_LABELS[part] ?? part.replace(/_/g, " "))
    .join(" · ");
}

function dayGroup(iso: string, t: (key: string) => string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t("common.today");
  if (date.toDateString() === yesterday.toDateString()) return t("activity.yesterday");
  return t("activity.earlier");
}

export default function MyActivityScreen({ route }: any) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"timeline" | "performance">(
    route?.params?.tab === "performance" ? "performance" : "timeline"
  );
  const [entries, setEntries] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any | null>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [windowDays, setWindowDays] = useState<7 | 30>(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.tab === "performance" || route?.params?.tab === "timeline") {
        setTab(route.params.tab);
      }
    }, [route?.params?.tab])
  );

  const load = useCallback(async () => {
    const to = new Date();
    const from = new Date(to.getTime() - (windowDays - 1) * 86_400_000);
    const [feed, stats, targetData, rankData, achievementData] = await Promise.all([
      repApi.activityFeed().catch(() => ({ entries: [] })),
      repApi.performance(from.toISOString(), to.toISOString()).catch(() => null),
      repApi.targets().catch(() => ({ targets: [] })),
      repApi.ranking().catch(() => null),
      repApi.achievements().catch(() => ({ achievements: [] })),
    ]);
    setEntries(feed.entries ?? []);
    setPerformance(stats);
    setTargets(targetData.targets ?? []);
    setRanking(rankData);
    setAchievements(achievementData.achievements ?? []);
  }, [windowDays]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const grouped = entries.reduce<Record<string, any[]>>((groups, entry) => {
    const key = dayGroup(entry.at, t);
    (groups[key] ??= []).push(entry);
    return groups;
  }, {});

  const monthLabel = windowDays === 7 ? "Last 7 days" : "Last 30 days";

  return (
    <AppScreen>
      <ScreenHeader title={t("activity.title")} />

      <View style={styles.tabs}>
        <FilterChip label={t("activity.timeline")} active={tab === "timeline"} onPress={() => setTab("timeline")} />
        <FilterChip
          label={t("activity.performance")}
          active={tab === "performance"}
          onPress={() => setTab("performance")}
        />
      </View>

      {loading ? (
        <View style={styles.skel}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {tab === "timeline" ? (
            entries.length === 0 ? (
              <EmptyState
                icon="timeline-clock-outline"
                title={t("activity.noActivity")}
                body="Your visits, orders, collections and tasks appear here as you work."
              />
            ) : (
              Object.entries(grouped).map(([day, dayEntries]) => (
                <View key={day}>
                  <Text style={styles.dayHeading}>{day}</Text>
                  {dayEntries.map((entry, index) => {
                    const meta = KIND_META[entry.kind] ?? { icon: "ellipse-outline", label: entry.kind };
                    return (
                      <TimelineEvent
                        key={entry.id}
                        icon={meta.icon}
                        title={
                          entry.kind === "activity" ? ACTIVITY_LABELS[entry.title] ?? entry.title : entry.title
                        }
                        context={[entry.retailer?.name, humanise(entry.detail)].filter(Boolean).join(" · ")}
                        amount={entry.amount ? inr(entry.amount) : undefined}
                        time={new Date(entry.at).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        last={index === dayEntries.length - 1}
                      />
                    );
                  })}
                </View>
              ))
            )
          ) : performance ? (
            <>
              <View>
                <View style={styles.between}>
                <Text style={styles.month}>{monthLabel}</Text>
                  <View style={styles.windowChips}>
                    <FilterChip label="7D" active={windowDays === 7} onPress={() => setWindowDays(7)} />
                    <FilterChip label="30D" active={windowDays === 30} onPress={() => setWindowDays(30)} />
                  </View>
                </View>
                <Text style={styles.sales} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {inr(performance.period.orderValue)}
                </Text>
                <Text style={styles.salesSub}>
                  {t("activity.salesHeadline")} · {performance.period.orders} {t("today.metricOrders").toLowerCase()} ·{" "}
                  {performance.period.visits} {t("today.metricVisits").toLowerCase()}
                </Text>
              </View>

              {targets[0] ? (
                <Surface>
                  <SectionHeader title="Target trajectory" />
                  <Text style={styles.targetLine}>
                    {targets[0].unit === "currency"
                      ? `${inr(targets[0].actual)} / ${inr(targets[0].target)}`
                      : `${targets[0].actual} / ${targets[0].target}`}{" "}
                    · {targets[0].completionPct}%
                  </Text>
                  <ProgressRow pct={targets[0].completionPct} tone="gold" />
                  <Text style={styles.conclusion}>Actual progress is {targets[0].completionPct}% of the current target.</Text>
                </Surface>
              ) : null}

              <Surface>
                <SectionHeader title={t("activity.thisMonth")} />
                <MetricStrip
                  bare
                  items={[
                    { label: t("today.metricVisits"), value: String(performance.period.visits) },
                    { label: t("activity.productiveVisits"), value: String(performance.period.productiveVisits) },
                    { label: t("activity.customersCovered"), value: String(performance.period.customersCovered) },
                    { label: t("today.metricOrders"), value: String(performance.period.orders) },
                    { label: t("today.metricCollected"), value: inr(performance.period.collectionValueConfirmed) },
                    { label: t("activity.newCustomers"), value: String(performance.period.newCustomers) },
                  ]}
                />
                <Text style={styles.days}>
                  {t("activity.daysWorked")} · {performance.period.attendance.present} /{" "}
                  {performance.period.attendance.workingDays}
                </Text>
              </Surface>

              {performance.visuals?.hasEnoughHistory ? (
                <>
                  <Surface>
                    <SectionHeader title="Sales trend" />
                    <Text style={styles.conclusion}>
                      {performance.period.orders > 0
                        ? `${performance.period.orders} orders contributed ${inr(performance.period.orderValue)} in this window.`
                        : "No orders were recorded in this window."}
                    </Text>
                    <VisualBars rows={(performance.visuals.salesTrend ?? []).map((row: any) => ({ label: row.date.slice(5), value: row.value, display: inr(row.value) }))} />
                  </Surface>
                  <Surface>
                    <SectionHeader title="Visits and productivity" />
                    <Text style={styles.conclusion}>
                      {performance.visuals.productivityPct == null
                        ? "There is not enough visit history to calculate productivity."
                        : `${performance.visuals.productivityPct}% of visits were productive in this window.`}
                    </Text>
                    <VisualBars rows={(performance.visuals.visitsTrend ?? []).map((row: any) => ({ label: row.date.slice(5), value: row.visits, display: `${row.productiveVisits}/${row.visits}` }))} />
                  </Surface>
                  <Surface>
                    <SectionHeader title="Orders by selling day" />
                    <Text style={styles.conclusion}>{performance.period.orders} orders were recorded across the selected days.</Text>
                    <VisualBars rows={(performance.visuals.ordersByDay ?? []).map((row: any) => ({ label: row.date.slice(5), value: row.orders, display: String(row.orders) }))} />
                  </Surface>
                  <Surface>
                    <SectionHeader title="Collections trend" />
                    <Text style={styles.conclusion}>{inr(performance.period.collectionValueConfirmed)} has been confirmed in collections during this window.</Text>
                    <VisualBars rows={(performance.visuals.collectionsTrend ?? []).map((row: any) => ({ label: row.date.slice(5), value: row.confirmedValue, display: inr(row.confirmedValue) }))} />
                  </Surface>
                  {(performance.visuals.categoryContribution ?? []).length > 0 ? (
                    <Surface>
                      <SectionHeader title="Category contribution" />
                      <Text style={styles.conclusion}>The strongest category in this window is {performance.visuals.categoryContribution[0].category}.</Text>
                      <VisualBars rows={performance.visuals.categoryContribution.slice(0, 5).map((row: any) => ({ label: row.category, value: row.sharePct, display: `${row.sharePct}%` }))} />
                    </Surface>
                  ) : null}
                  {(performance.visuals.routeCompletionTrend ?? []).length > 1 ? (
                    <Surface>
                      <SectionHeader title="Route completion" />
                      <Text style={styles.conclusion}>Route completion is shown only for published route days.</Text>
                      <VisualBars rows={performance.visuals.routeCompletionTrend.map((row: any) => ({ label: row.date.slice(5), value: row.completionPct, display: `${row.completionPct}%` }))} />
                    </Surface>
                  ) : null}
                </>
              ) : null}

              <Surface>
                <SectionHeader title={t("performance.targets")} />
                {targets.length === 0 ? (
                  <Text style={styles.muted}>{t("performance.noTargets")}</Text>
                ) : (
                  targets.map((target: any) => (
                    <View key={target.metric} style={{ gap: 6, marginTop: spacing.sm }}>
                      <View style={styles.between}>
                        <Text style={styles.targetLabel}>{target.label}</Text>
                        <Text style={styles.muted}>
                          {target.unit === "currency"
                            ? `${inr(target.actual)} / ${inr(target.target)}`
                            : `${target.actual} / ${target.target}`}
                        </Text>
                      </View>
                      <ProgressRow pct={target.completionPct} tone="gold" />
                      <Text style={styles.targetSource}>{target.source}</Text>
                    </View>
                  ))
                )}
              </Surface>

              <Surface>
                <SectionHeader title={t("activity.teamPosition")} />
                {ranking?.rank ? (
                  <>
                    <Text style={styles.rank}>#{ranking.rank}</Text>
                    <Text style={styles.muted}>
                      {ranking.participants === 1
                        ? t("activity.ofSalespeople", { count: ranking.participants })
                        : t("activity.ofSalespeoplePlural", { count: ranking.participants })}
                    </Text>
                    {ranking.participants <= 1 ? null : ranking.movement && ranking.movement.direction !== "new" ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <StatusChip
                          label={
                            ranking.movement.direction === "same"
                              ? t("today.rankSame")
                              : t(
                                  ranking.movement.direction === "up" ? "today.rankUp" : "today.rankDown",
                                  { places: String(ranking.movement.places) }
                                )
                          }
                          tone={ranking.movement.direction === "up" ? "green" : "neutral"}
                        />
                      </View>
                    ) : null}
                    <Text style={styles.targetSource}>
                      {ranking.metricLabel} · {ranking.scopeLabel}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.muted}>{t("performance.noRanking")}</Text>
                )}
              </Surface>

              <Surface>
                <SectionHeader title={t("performance.achievements")} />
                {achievements.length === 0 ? (
                  <Text style={styles.muted}>{t("performance.noAchievements")}</Text>
                ) : (
                  achievements.map((achievement: any) => (
                    <AchievementLine key={achievement.id} achievement={achievement} />
                  ))
                )}
              </Surface>
            </>
          ) : (
            <EmptyState
              icon="chart-line"
              title="Performance is not available"
              body="Pull down to try again once you have a connection."
            />
          )}
        </ScrollView>
      )}
    </AppScreen>
  );
}

function VisualBars({ rows }: { rows: Array<{ label: string; value: number; display: string }> }) {
  const visible = rows.slice(-7);
  const max = Math.max(...visible.map((row) => row.value), 1);
  return (
    <View style={styles.visualBars}>
      {visible.map((row) => (
        <View key={row.label} style={styles.barRow}>
          <Text style={styles.barLabel}>{row.label}</Text>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, (row.value / max) * 100)}%` }]} /></View>
          <Text style={styles.barValue}>{row.display}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  skel: { paddingHorizontal: spacing.xl, gap: spacing.md },
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  dayHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  month: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  sales: { fontSize: 32, fontWeight: "600", color: colors.ink, letterSpacing: -0.6, marginTop: 4 },
  salesSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  targetLine: { fontSize: 15, fontWeight: "600", color: colors.goldStrong },
  days: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.md },
  muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  targetLabel: { fontSize: 14, fontWeight: "600", color: colors.ink, flex: 1 },
  targetSource: { fontSize: 11, color: colors.textTertiary, lineHeight: 16 },
  rank: { fontSize: 32, fontWeight: "600", color: colors.ink, letterSpacing: -0.6 },
  windowChips: { flexDirection: "row", gap: spacing.xs },
  conclusion: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  visualBars: { gap: spacing.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { width: 46, fontSize: 11, color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 99, backgroundColor: colors.green },
  barValue: { width: 60, fontSize: 11, color: colors.ink, textAlign: "right" },
});
