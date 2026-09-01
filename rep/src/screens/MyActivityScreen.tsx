import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Card, EmptyState, ListRow, MetricTile, ProgressTrack, ScreenHeader, SectionTitle, Tag } from "../components/ui";
import { ACTIVITY_LABELS } from "../components/ActivityComposer";
import { AchievementLine } from "../components/Achievement";
import { repApi } from "../api/repClient";
import { colors, inr, radius, spacing, TAB_BAR_SPACE } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const KIND_META: Record<string, { icon: string; label: string }> = {
  workday_started: { icon: "play-circle-outline", label: "Day started" },
  workday_ended: { icon: "stop-circle-outline", label: "Day ended" },
  visit: { icon: "location-outline", label: "Visit" },
  activity: { icon: "clipboard-outline", label: "Activity" },
  order: { icon: "cart-outline", label: "Order" },
  collection: { icon: "cash-outline", label: "Collection" },
  task_completed: { icon: "checkmark-done-outline", label: "Task" },
  expense: { icon: "wallet-outline", label: "Expense" },
  service_issue: { icon: "alert-circle-outline", label: "Issue" },
};

const TARGET_LABELS: Record<string, string> = {
  order_value: "Order value",
  visits: "Visits",
  collection_value: "Collections",
  new_customers: "New customers",
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

/** Enum values reach the feed raw; show the salesperson words, not columns. */
function humanise(detail: string | null): string | null {
  if (!detail) return null;
  return detail
    .split(" · ")
    .map((part) => OUTCOME_LABELS[part] ?? ACTIVITY_LABELS[part] ?? part.replace(/_/g, " "))
    .join(" · ");
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday
    ? "Today"
    : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The salesperson's own history and performance. Both are projections of the
 * canonical rows — visits, orders, collections, workdays — rather than a
 * separate timeline table.
 */
export default function MyActivityScreen() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"timeline" | "performance">("timeline");
  const [entries, setEntries] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any | null>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [feed, stats, targetData, rankData, achievementData] = await Promise.all([
      repApi.activityFeed().catch(() => ({ entries: [] })),
      repApi.performance().catch(() => null),
      repApi.targets().catch(() => ({ targets: [] })),
      repApi.ranking().catch(() => null),
      repApi.achievements().catch(() => ({ achievements: [] })),
    ]);
    setEntries(feed.entries ?? []);
    setPerformance(stats);
    setTargets(targetData.targets ?? []);
    setRanking(rankData);
    setAchievements(achievementData.achievements ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const grouped = entries.reduce<Record<string, any[]>>((groups, entry) => {
    const key = dayLabel(entry.at);
    (groups[key] ??= []).push(entry);
    return groups;
  }, {});

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("activity.title")} />

      <View style={styles.tabs}>
        {(
          [
            ["timeline", t("activity.timeline")],
            ["performance", t("activity.performance")],
          ] as const
        ).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.tab, tab === value && styles.tabActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
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
              tintColor={colors.green}
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
                <View key={day} style={{ gap: spacing.sm }}>
                  <Text style={styles.dayHeading}>{day}</Text>
                  <Card>
                    {dayEntries.map((entry, index) => {
                      const meta = KIND_META[entry.kind] ?? { icon: "ellipse-outline", label: entry.kind };
                      return (
                        <View
                          key={entry.id}
                          style={[styles.entry, index > 0 && styles.entryDivided]}
                        >
                          <View style={styles.entryIcon}>
                            <Ionicons name={meta.icon as any} size={16} color={colors.green} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.entryTitle} numberOfLines={2}>
                              {entry.kind === "activity"
                                ? ACTIVITY_LABELS[entry.title] ?? entry.title
                                : entry.title}
                            </Text>
                            <Text style={styles.entrySub} numberOfLines={2}>
                              {[
                                new Date(entry.at).toLocaleTimeString("en-IN", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                }),
                                entry.retailer?.name,
                                humanise(entry.detail),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </View>
                          {entry.amount ? (
                            <Text style={styles.entryAmount}>{inr(entry.amount)}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ))
            )
          ) : performance ? (
            <>
              <Card>
                <SectionTitle title={t("common.today")} />
                <View style={styles.metrics}>
                  <MetricTile label={t("today.metricVisits")} value={String(performance.today.visits)} />
                  <MetricTile label={t("today.metricOrders")} value={String(performance.today.orders)} />
                  <MetricTile
                    label={t("today.metricOrderValue")}
                    value={inr(performance.today.orderValue)}
                    tone="green"
                  />
                </View>
              </Card>

              <Card>
                <SectionTitle title={t("activity.thisMonth")} />
                <View style={styles.metrics}>
                  <MetricTile label={t("today.metricVisits")} value={String(performance.period.visits)} />
                  <MetricTile
                    label={t("activity.productiveVisits")}
                    value={String(performance.period.productiveVisits)}
                    tone="green"
                  />
                  <MetricTile
                    label={t("activity.customersCovered")}
                    value={String(performance.period.customersCovered)}
                  />
                </View>
                <View style={styles.metrics}>
                  <MetricTile label={t("today.metricOrders")} value={String(performance.period.orders)} />
                  <MetricTile
                    label={t("today.metricOrderValue")}
                    value={inr(performance.period.orderValue)}
                  />
                  <MetricTile
                    label={t("today.metricCollected")}
                    value={inr(performance.period.collectionValueConfirmed)}
                    tone="green"
                  />
                </View>
                <View style={styles.metrics}>
                  <MetricTile
                    label={t("activity.daysWorked")}
                    value={`${performance.period.attendance.present}/${performance.period.attendance.workingDays}`}
                  />
                  <MetricTile
                    label={t("myday.onLeave")}
                    value={String(performance.period.attendance.leave)}
                  />
                  <MetricTile
                    label={t("activity.newCustomers")}
                    value={String(performance.period.newCustomers)}
                  />
                </View>
              </Card>

              <Card>
                <SectionTitle title={t("performance.targets")} />
                {targets.length === 0 ? (
                  <Text style={styles.muted}>{t("performance.noTargets")}</Text>
                ) : (
                  targets.map((target: any) => (
                    <View key={target.metric} style={{ gap: 5, marginTop: spacing.sm }}>
                      <View style={styles.between}>
                        <Text style={styles.targetLabel}>{target.label}</Text>
                        <Text style={styles.targetValue}>
                          {target.unit === "currency"
                            ? `${inr(target.actual)} / ${inr(target.target)}`
                            : `${target.actual} / ${target.target}`}
                        </Text>
                      </View>
                      <ProgressTrack pct={target.completionPct} tone="accent" />
                      <Text style={styles.targetSentence}>{target.sentence}</Text>
                      {/* Where the number came from, so a target is never a black box. */}
                      <Text style={styles.targetSource}>{target.source}</Text>
                    </View>
                  ))
                )}
              </Card>

              <Card>
                <SectionTitle title={t("performance.ranking")} />
                {ranking?.rank ? (
                  <>
                    <View style={styles.between}>
                      <Text style={styles.rankBig}>
                        #{ranking.rank}
                        <Text style={styles.rankOf}> of {ranking.participants}</Text>
                      </Text>
                      {ranking.movement && ranking.movement.direction !== "new" ? (
                        <Tag
                          label={
                            ranking.movement.direction === "same"
                              ? t("today.rankSame")
                              : t(
                                  ranking.movement.direction === "up"
                                    ? "today.rankUp"
                                    : "today.rankDown",
                                  { places: String(ranking.movement.places) }
                                )
                          }
                          tone={ranking.movement.direction === "up" ? "green" : "neutral"}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.muted}>
                      {ranking.metricLabel} · {ranking.scopeLabel}
                    </Text>
                    {/* Why this metric, so a ranking is never unexplained. */}
                    <Text style={styles.targetSource}>{ranking.metricReason}</Text>
                  </>
                ) : (
                  <Text style={styles.muted}>{t("performance.noRanking")}</Text>
                )}
              </Card>

              <Card>
                <SectionTitle title={t("performance.achievements")} />
                {achievements.length === 0 ? (
                  <Text style={styles.muted}>{t("performance.noAchievements")}</Text>
                ) : (
                  achievements.map((achievement: any) => (
                    <AchievementLine key={achievement.id} achievement={achievement} />
                  ))
                )}
              </Card>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: TAB_BAR_SPACE + spacing.xl },

  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.inkMuted },
  tabTextActive: { color: colors.green },

  dayHeading: { fontSize: 12, fontWeight: "800", color: colors.inkMuted, letterSpacing: 0.4 },
  entry: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  entryDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  entryTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  entrySub: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2, lineHeight: 16 },
  entryAmount: { fontSize: 13, fontWeight: "700", color: colors.ink },

  metrics: { flexDirection: "row", gap: spacing.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  targetLabel: { fontSize: 12.5, color: colors.ink, fontWeight: "600" },
  targetValue: { fontSize: 12.5, color: colors.inkMuted },
  targetSentence: { fontSize: 12.5, color: colors.accentStrong, fontWeight: "700" },
  targetSource: { fontSize: 11, color: colors.inkFaint, lineHeight: 16 },
  rankBig: { fontSize: 26, fontWeight: "800", color: colors.ink },
  rankOf: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
});
