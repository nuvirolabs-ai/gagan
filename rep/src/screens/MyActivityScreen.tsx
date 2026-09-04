import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Circle, Line, Path, Svg } from "react-native-svg";
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
import { colors, inr, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import { useLanguage } from "../i18n/LanguageContext";
import {
  chartDateLabel,
  chartRows,
  compactInr,
  metricDisplay,
  metricRows,
  type MetricRow,
  type PerformanceMetric,
} from "./performancePresentation";

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
              <PerformanceCockpit
                performance={performance}
                targets={targets}
                ranking={ranking}
                achievements={achievements}
                windowDays={windowDays}
                setWindowDays={setWindowDays}
                monthLabel={monthLabel}
                t={t}
              />
              {false && (
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
                  <ProgressRow pct={targets[0].completionPct} tone="green" />
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
                      <ProgressRow pct={target.completionPct} tone="green" />
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
            </>)}
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

// Retained only for the unreachable legacy branch below while the next
// performance surface remains isolated. The rendered cockpit uses the single
// dynamic TrendChart instead.
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

function TrendChart({ rows, metric }: { rows: MetricRow[]; metric: PerformanceMetric }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(260, Math.min(width - spacing.xl * 2 - spacing.lg * 2, 520));
  const chartHeight = 156;
  const inset = { top: 12, right: 8, bottom: 18, left: 8 };
  const plotWidth = chartWidth - inset.left - inset.right;
  const plotHeight = chartHeight - inset.top - inset.bottom;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const points = rows.map((row, index) => {
    const x = inset.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
    const y = inset.top + plotHeight - (row.value / max) * plotHeight;
    return { ...row, x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${(inset.top + plotHeight).toFixed(1)} L${points[0].x.toFixed(1)},${(inset.top + plotHeight).toFixed(1)} Z`;
  const labels = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].filter(Boolean);
  return (
    <View accessible accessibilityLabel={`${metric} trend for the selected period`}>
      <Svg width={chartWidth} height={chartHeight}>
        <Line x1={inset.left} x2={chartWidth - inset.right} y1={inset.top} y2={inset.top} stroke={colors.track} strokeWidth="1" />
        <Line x1={inset.left} x2={chartWidth - inset.right} y1={inset.top + plotHeight / 2} y2={inset.top + plotHeight / 2} stroke={colors.track} strokeWidth="1" />
        <Line x1={inset.left} x2={chartWidth - inset.right} y1={inset.top + plotHeight} y2={inset.top + plotHeight} stroke={colors.track} strokeWidth="1" />
        <Path d={area} fill={colors.surfaceSecondary} opacity={0.95} />
        <Path d={line} fill="none" stroke={colors.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill={colors.primary} />
      </Svg>
      <View style={styles.chartLabels}>
        {labels.map((row, index) => <Text key={`${row!.date}-${index}`} style={styles.chartLabel}>{chartDateLabel(row!.date)}</Text>)}
      </View>
      <Text style={styles.chartScale}>Scale: {metricDisplay(metric, max)} peak in selected window</Text>
    </View>
  );
}

function PerformanceCockpit({
  performance,
  targets,
  ranking,
  achievements,
  windowDays,
  setWindowDays,
  monthLabel,
  t,
}: any) {
  const [metric, setMetric] = useState<PerformanceMetric>("sales");
  const [dailyDetailOpen, setDailyDetailOpen] = useState(false);
  const period = performance.period;
  const visuals = performance.visuals;
  const rows = chartRows(visuals, metric, windowDays);
  const rawRows = metricRows(visuals, metric);
  const target = (performance.targets ?? []).find((item: any) => item.metric === "order_value") ?? targets.find((item: any) => item.metric === "order_value") ?? targets[0];
  const completion = target?.achievementPct ?? target?.completionPct ?? 0;
  const routeRows = visuals?.routeCompletionTrend ?? [];
  const planned = routeRows.reduce((sum: number, row: any) => sum + (Number(row.planned) || 0), 0);
  const visited = routeRows.reduce((sum: number, row: any) => sum + (Number(row.visited) || 0), 0);
  const funnel = [
    { label: "Planned", value: planned || null },
    { label: "Visited", value: period.visits },
    { label: "Productive", value: period.productiveVisits },
    { label: "Ordering retailers", value: period.customersWithOrders ?? null },
  ];
  const metricValue =
    metric === "sales" ? period.orderValue : metric === "orders" ? period.orders : metric === "visits" ? period.visits : period.collectionValueConfirmed;
  const insights = [
    period.orders > 0 ? `${period.orders} orders contributed ${compactInr(period.orderValue)} in this window.` : "No orders were recorded in this window.",
    period.visits > 0 && period.productiveVisits >= 0 ? `${period.productiveVisits} of ${period.visits} visits were productive.` : "No visit activity is recorded in this window.",
    period.collectionValueConfirmed > 0 ? `${compactInr(period.collectionValueConfirmed)} was confirmed in collections.` : "No confirmed collections are recorded in this window.",
  ];
  return (
    <>
      <View style={styles.performanceIntro}>
        <View style={styles.between}>
          <View>
            <Text style={styles.periodKicker}>PERFORMANCE · {monthLabel.toUpperCase()}</Text>
            <Text style={styles.performanceTitle}>Your operating pulse</Text>
          </View>
          <View style={styles.windowChips}>
            <FilterChip label="7D" active={windowDays === 7} onPress={() => setWindowDays(7)} />
            <FilterChip label="30D" active={windowDays === 30} onPress={() => setWindowDays(30)} />
          </View>
        </View>
        <Text style={styles.performanceNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {metricDisplay(metric, metricValue)}
        </Text>
        <Text style={styles.salesSub}>{metric === "sales" ? "Sales value" : metric[0].toUpperCase() + metric.slice(1)} · {period.attendance.present} working days</Text>
      </View>

      <Surface level={1} style={styles.cockpitSurface}>
        <View style={styles.metricBand}>
          {[
            ["Sales", compactInr(period.orderValue)],
            ["Orders", String(period.orders)],
            ["Visits", String(period.visits)],
            ["Collections", compactInr(period.collectionValueConfirmed)],
          ].map(([label, value], index) => (
            <View key={label} style={[styles.bandCell, index > 0 && styles.bandCellDivided]}>
              <Text style={styles.bandValue} numberOfLines={1}>{value}</Text>
              <Text style={styles.bandLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.instrumentDivider} />
        <View style={styles.targetInstrument}>
          <View style={styles.between}>
            <View>
              <Text style={styles.instrumentLabel}>TARGET INSTRUMENT</Text>
              <Text style={styles.targetTitle}>Order value</Text>
            </View>
            {target ? <Text style={styles.targetPct}>{completion}%</Text> : <Text style={styles.muted}>No target</Text>}
          </View>
          {target ? <ProgressRow pct={completion} tone="green" /> : null}
          <Text style={styles.instrumentMeta}>{target ? `${compactInr(target.achieved ?? target.actual ?? period.orderValue)} of ${compactInr(target.target)}` : "A target will appear once your manager configures one."}</Text>
        </View>
      </Surface>

      <Surface level={1} style={styles.chartSurface}>
        <View style={styles.between}>
          <View>
            <Text style={styles.instrumentLabel}>TREND</Text>
            <Text style={styles.sectionTitle}>{metric[0].toUpperCase() + metric.slice(1)} over time</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setDailyDetailOpen(true)} style={({ pressed }) => [styles.detailLink, pressed && { opacity: 0.65 }]}>
            <Text style={styles.detailLinkText}>Daily detail</Text>
          </Pressable>
        </View>
        <View style={styles.metricPicker}>
          {(["sales", "orders", "visits", "collections"] as PerformanceMetric[]).map((key) => (
            <FilterChip key={key} label={key[0].toUpperCase() + key.slice(1)} active={metric === key} onPress={() => setMetric(key)} />
          ))}
        </View>
        {rows.length === 0 || rows.every((row) => row.value === 0) ? (
          <View style={styles.zeroState}>
            <Text style={styles.zeroTitle}>{metric === "collections" ? "No confirmed collections in this period." : `No ${metric} recorded in this period.`}</Text>
            <Text style={styles.muted}>The chart will appear when canonical activity is recorded.</Text>
          </View>
        ) : <TrendChart rows={rows} metric={metric} />}
      </Surface>

      <Surface level={1} style={styles.funnelSurface}>
        <View style={styles.between}><View><Text style={styles.instrumentLabel}>PRODUCTIVITY FUNNEL</Text><Text style={styles.sectionTitle}>From plan to ordering</Text></View><Text style={styles.muted}>{planned ? `${visited}/${planned} visited` : "Plan baseline unavailable"}</Text></View>
        <View style={styles.funnelList}>
          {funnel.map((item, index) => {
            const denominator = planned || Math.max(...funnel.map((entry) => entry.value ?? 0), 1);
            const pct = item.value == null ? 0 : Math.min(100, (item.value / denominator) * 100);
            return <View key={item.label} style={styles.funnelRow}><View style={styles.between}><Text style={styles.funnelLabel}>{item.label}</Text><Text style={styles.funnelValue}>{item.value == null ? "—" : item.value}</Text></View><View style={styles.funnelTrack}><View style={[styles.funnelFill, { width: `${pct}%`, opacity: index === 0 ? 0.45 : 1 }]} /></View></View>;
          })}
        </View>
      </Surface>

      <Surface level={1} style={styles.insightsSurface}>
        <Text style={styles.instrumentLabel}>READOUT</Text>
        {insights.map((insight, index) => <View key={insight} style={styles.insightRow}><Text style={styles.insightIndex}>0{index + 1}</Text><Text style={styles.insightText}>{insight}</Text></View>)}
      </Surface>

      {(targets.length > 0 || ranking?.rank || achievements.length > 0) ? (
        <View style={styles.secondaryBlock}>
          {targets.length > 0 ? <Surface level={1}><SectionHeader title={t("performance.targets")} />{targets.slice(0, 3).map((item: any) => <View key={item.metric} style={styles.secondaryRow}><Text style={styles.targetLabel}>{item.label}</Text><Text style={styles.muted}>{item.achievementPct ?? item.completionPct}% · {item.source}</Text></View>)}</Surface> : null}
          {ranking?.rank ? <Surface level={1}><SectionHeader title={t("activity.teamPosition")} /><Text style={styles.rank}>#{ranking.rank}</Text><Text style={styles.muted}>{ranking.metricLabel} · {ranking.scopeLabel}</Text></Surface> : null}
          {achievements.length > 0 ? <Surface level={1}><SectionHeader title={t("performance.achievements")} />{achievements.slice(0, 3).map((achievement: any) => <AchievementLine key={achievement.id} achievement={achievement} />)}</Surface> : null}
        </View>
      ) : null}

      <Modal visible={dailyDetailOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDailyDetailOpen(false)}>
        <View style={styles.detailSheet}><View style={styles.between}><View><Text style={styles.periodKicker}>DAILY LEDGER</Text><Text style={styles.detailTitle}>{metric[0].toUpperCase() + metric.slice(1)} · {monthLabel}</Text></View><Pressable accessibilityRole="button" onPress={() => setDailyDetailOpen(false)}><Text style={styles.detailClose}>Done</Text></Pressable></View><ScrollView contentContainerStyle={styles.detailList}>{rawRows.length === 0 ? <Text style={styles.muted}>No canonical daily activity is available.</Text> : rawRows.slice().reverse().map((row) => <View key={row.date} style={styles.detailRow}><Text style={styles.detailDate}>{chartDateLabel(row.date)}</Text><Text style={styles.detailValue}>{metricDisplay(metric, row.value)}</Text></View>)}</ScrollView></View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  skel: { paddingHorizontal: spacing.xl, gap: spacing.md },
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP },
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
  barFill: { height: "100%", borderRadius: 99, backgroundColor: colors.blue },
  barValue: { width: 60, fontSize: 11, color: colors.ink, textAlign: "right" },
  performanceIntro: { gap: spacing.xs },
  periodKicker: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1.2, fontWeight: "700" },
  performanceTitle: { fontSize: 20, fontWeight: "700", color: colors.ink, marginTop: 3 },
  performanceNumber: { fontSize: 34, lineHeight: 40, fontWeight: "700", color: colors.ink, letterSpacing: -0.8, marginTop: spacing.md, fontVariant: ["tabular-nums"] },
  cockpitSurface: { padding: spacing.lg, gap: spacing.lg },
  metricBand: { flexDirection: "row", alignItems: "stretch" },
  bandCell: { flex: 1, gap: 3 },
  bandCellDivided: { borderLeftWidth: 1, borderLeftColor: colors.separator, paddingLeft: spacing.md, marginLeft: spacing.md },
  bandValue: { fontSize: 16, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  bandLabel: { fontSize: 11, color: colors.textSecondary },
  instrumentDivider: { height: 1, backgroundColor: colors.separator },
  targetInstrument: { gap: spacing.sm },
  instrumentLabel: { fontSize: 10, letterSpacing: 1.1, fontWeight: "700", color: colors.textSecondary },
  targetTitle: { fontSize: 16, fontWeight: "600", color: colors.ink, marginTop: 3 },
  targetPct: { fontSize: 24, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  instrumentMeta: { fontSize: 12, color: colors.textSecondary },
  chartSurface: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 3 },
  metricPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  detailLink: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  detailLinkText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -spacing.sm },
  chartLabel: { fontSize: 10, color: colors.textSecondary },
  chartScale: { fontSize: 10, color: colors.textTertiary, marginTop: spacing.xs },
  zeroState: { paddingVertical: spacing.xl, gap: spacing.xs },
  zeroTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  funnelSurface: { padding: spacing.lg, gap: spacing.lg },
  funnelList: { gap: spacing.md },
  funnelRow: { gap: spacing.xs },
  funnelLabel: { fontSize: 13, color: colors.textSecondary },
  funnelValue: { fontSize: 14, color: colors.ink, fontWeight: "700", fontVariant: ["tabular-nums"] },
  funnelTrack: { height: 7, backgroundColor: colors.track, borderRadius: 99, overflow: "hidden" },
  funnelFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 99 },
  insightsSurface: { padding: spacing.lg, gap: spacing.sm },
  insightRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingVertical: spacing.xs },
  insightIndex: { fontSize: 10, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.5 },
  insightText: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18 },
  secondaryBlock: { gap: spacing.section },
  secondaryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.md },
  detailSheet: { flex: 1, padding: spacing.xl, paddingTop: spacing.block, backgroundColor: colors.bg },
  detailTitle: { fontSize: 22, fontWeight: "700", color: colors.ink, marginTop: spacing.xs },
  detailClose: { fontSize: 15, color: colors.ink, fontWeight: "700" },
  detailList: { paddingTop: spacing.block, paddingBottom: spacing.xxl, gap: 0 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.separator },
  detailDate: { fontSize: 13, color: colors.textSecondary },
  detailValue: { fontSize: 14, color: colors.ink, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
