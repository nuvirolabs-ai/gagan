import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  AppScreen,
  AttentionRow,
  EmptyState,
  FocusCard,
  MetricStrip,
  OfflineBanner,
  PersonalGreeting,
  PrimaryButton,
  ProgressRow,
  SecondaryButton,
  SectionHeader,
  Skeleton,
  Surface,
  TaskRow,
  TextButton,
} from "../components/ui";
import { AchievementCard } from "../components/Achievement";
import { visibleAttentionItems } from "./attentionFeed";
import { haptic } from "../feedback/haptics";
import { useField } from "../context/FieldContext";
import { useRep } from "../context/RepContext";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { trackingBanner } from "../tracking/fieldTracker";
import { colors, greetingForHour, inr, spacing, TAB_BAR_SPACE } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const OPPORTUNITY_ICONS: Record<string, string> = {
  ORDER_DUE: "time-outline",
  HIGH_VALUE_RETAILER_MISSED: "alert-circle-outline",
  VISIT_OVERDUE: "walk-outline",
  COLLECTION_DUE: "wallet-outline",
  ORDER_VALUE_BELOW_NORMAL: "trending-down-outline",
  LINE_ITEMS_BELOW_NORMAL: "list-outline",
  CATEGORY_REORDER_OPPORTUNITY: "cube-outline",
};

function formatTarget(value: number, unit: string): string {
  return unit === "currency" ? inr(value) : String(Math.round(value));
}

function duration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function formatClock(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

export default function TodayScreen({ navigation }: any) {
  const { today, celebrations, dismissCelebration, loading, error, refresh, tracking, outbox, startDay, endDay } =
    useField();
  const { staff } = useRep();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const attendance = today?.attendance;
  const dayOpen = attendance?.status === "open";
  const dayClosed = attendance?.status === "closed";
  const toggleDay = async () => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied") {
      haptic("warning");
      return Alert.alert(
        "Location permission needed",
        reading.canAskAgain
          ? "Allow location while using the app so your day can be recorded."
          : "Turn on location access in Settings to start your day."
      );
    }
    if (reading.kind === "unavailable") {
      haptic("warning");
      return Alert.alert("Location unavailable", reading.message);
    }
    setBusy(true);
    try {
      if (dayOpen) {
        await endDay(reading);
        haptic("success");
      } else {
        await startDay(reading);
        haptic("medium");
      }
    } catch (err: any) {
      haptic("warning");
      Alert.alert(
        dayOpen ? "Could not end your day" : "Could not start your day",
        err?.message === "workday_already_completed"
          ? "You have already completed today's attendance."
          : err?.message === "attendance_photo_required"
            ? "Your organisation requires an attendance photo. Ask your administrator to enable photo capture in the app."
            : "Try again when you have a connection."
      );
    } finally {
      setBusy(false);
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      await repApi.setTaskStatus(taskId, "done");
      haptic("success");
      await refresh();
    } catch {
      Alert.alert("Could not update the task", "Try again when you have a connection.");
    }
  };

  const navigateTo = (stop: any) => {
    const { latitude, longitude, name } = stop.retailer;
    if (latitude == null || longitude == null) {
      return Alert.alert(
        "No saved location",
        "This store has no saved location yet. Open the store and capture it while you are there."
      );
    }
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`).catch(() =>
        Alert.alert("No maps app", "This phone has no app that can open directions.")
      )
    );
  };

  const salutation =
    greetingForHour(new Date().getHours()) === "morning"
      ? t("today.goodMorning")
      : greetingForHour(new Date().getHours()) === "afternoon"
        ? t("today.goodAfternoon")
        : t("today.goodEvening");

  if (loading && !today) {
    return (
      <AppScreen>
        <PersonalGreeting name={staff?.name ?? ""} salutation={salutation} dateLabel={formatLongDate()} />
        <View style={styles.pad}>
          <Skeleton height={148} radius={24} />
          <View style={{ height: spacing.section }} />
          <Skeleton height={72} radius={16} />
        </View>
      </AppScreen>
    );
  }

  if (!today) {
    return (
      <AppScreen>
        <PersonalGreeting name={staff?.name ?? ""} salutation={salutation} dateLabel={formatLongDate()} />
        <EmptyState
          icon="calendar-blank-outline"
          title="Your day is not available"
          body={error ?? "Pull down to try again once you have a connection."}
          actionLabel={t("common.retry")}
          onAction={() => void refresh()}
        />
      </AppScreen>
    );
  }

  const banner = trackingBanner({
    tracking: tracking?.tracking ?? false,
    reason: tracking?.reason ?? "off_duty",
    pendingUploads: outbox.pending,
  });
  const route = today.route;
  const metrics = today.todayMetrics;
  const headlineTarget = today.headlineTarget;
  const nextStop = route?.nextStop;
  const overdueLead = today.pendingCollections?.retailers?.[0];
  const pendingRetailers = today.pendingCollections?.retailers ?? [];
  const attentionItems = visibleAttentionItems({
    overdueRetailers: pendingRetailers,
    opportunityActions: today.opportunities?.actions ?? [],
  });
  const opportunityLead = today.opportunities?.actions?.[0];

  const hero =
    dayOpen && overdueLead && Number(overdueLead.overdue) > 0
      ? {
          kind: "attention" as const,
          name: overdueLead.name,
          address: overdueLead.shopAddress,
          primary: `${inr(overdueLead.overdue)} overdue`,
          secondary: "Collection follow-up recommended",
          retailerId: overdueLead.id,
          stop: null,
        }
      : dayOpen && nextStop
        ? {
            kind: "route" as const,
            name: nextStop.retailer.name,
            address: nextStop.retailer.shopAddress,
            primary: nextStop.retailer.shopAddress,
            secondary: null,
            retailerId: nextStop.retailer.id,
            stop: nextStop,
          }
        : dayOpen && opportunityLead
          ? {
              kind: "attention" as const,
              name: opportunityLead.headline,
              address: opportunityLead.why,
              primary: opportunityLead.why,
              secondary: null,
              retailerId: opportunityLead.retailerId,
              stop: null,
            }
          : null;

  const remainingTasks = today.tasks.filter((task: any) => task.status !== "done" && task.status !== "cancelled");
  const planned = route?.progress?.total ?? 0;
  const visited = (route?.progress?.visited ?? 0) + (route?.progress?.skipped ?? 0);

  return (
    <AppScreen>
      <PersonalGreeting
        name={staff?.name ?? ""}
        salutation={dayClosed ? t("today.niceWork") : salutation}
        dateLabel={formatLongDate()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error ? <OfflineBanner title={t("today.offline")} body={error || t("today.offlineBody")} /> : null}

        <FocusCard tone={dayClosed ? "gold" : dayOpen ? "green" : "neutral"}>
          <Text style={styles.dayEyebrow}>
            {dayOpen ? t("today.dayRunning") : dayClosed ? t("today.dayEnded") : t("today.dayNotStarted")}
          </Text>
          <Text style={styles.dayTitle}>
            {dayClosed
              ? t("today.worked", { duration: duration(attendance.minutesSoFar) })
              : dayOpen
                ? t("today.startedAt", { time: formatClock(attendance.startedAt) })
                : planned > 0
                  ? t("today.storesPlanned", { count: planned })
                  : t("today.noRoutePublished")}
          </Text>
          {dayClosed && planned > 0 ? (
            <Text style={styles.daySupport}>
              {t("today.visitsCompleted", { done: visited, total: planned })}
            </Text>
          ) : (
            <Text style={styles.daySupport}>{banner.body}</Text>
          )}
          {attendance.status !== "closed" ? (
            <PrimaryButton
              label={dayOpen ? t("today.endDay") : t("today.startDay")}
              icon={dayOpen ? "stop-circle-outline" : "play-circle-outline"}
              tone={dayOpen ? "danger" : "green"}
              disabled={busy}
              onPress={() => void toggleDay()}
            />
          ) : (
            <TextButton label={t("today.seeActivity")} onPress={() => navigation.navigate("Activity")} />
          )}
        </FocusCard>

        {dayClosed ? (
          <MetricStrip
            items={[
              { label: t("today.metricVisits"), value: String(metrics.visits ?? visited) },
              { label: t("today.metricOrders"), value: String(metrics.orders) },
              { label: t("today.metricOrderValue"), value: inr(metrics.orderValue ?? 0) },
            ]}
          />
        ) : null}

        {hero && !dayClosed ? (
          <FocusCard tone={hero.kind === "attention" ? "danger" : "green"}>
            <SectionHeader title={t("today.upNext")} />
            <Text style={styles.heroName} numberOfLines={2}>
              {hero.name}
            </Text>
            {hero.address ? (
              <Text style={styles.heroAddress} numberOfLines={2}>
                {hero.address}
              </Text>
            ) : null}
            {hero.kind === "attention" && hero.secondary ? (
              <Text style={styles.heroNote}>{hero.secondary}</Text>
            ) : null}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={t("today.openStore")}
                  icon="storefront-outline"
                  onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: hero.retailerId })}
                />
              </View>
              {hero.stop ? (
                <View style={{ flex: 1 }}>
                  <SecondaryButton label={t("route.navigate")} icon="navigate-outline" onPress={() => navigateTo(hero.stop)} />
                </View>
              ) : null}
            </View>
          </FocusCard>
        ) : null}

        {!dayClosed ? (
          <MetricStrip
            items={[
              {
                label: t("today.metricVisits"),
                value: route ? `${route.progress.visited} / ${route.progress.total}` : "—",
              },
              { label: t("today.metricOrders"), value: String(metrics.orders) },
              { label: t("today.metricOrderValue"), value: inr(metrics.orderValue ?? 0) },
              { label: t("today.metricCollected"), value: inr(metrics.collectionValueConfirmed ?? 0) },
            ]}
          />
        ) : null}

        {headlineTarget ? (
          <Surface>
            <SectionHeader
              title={headlineTarget.label || t("today.monthlySales")}
              action={
                today.targets.length > 1 ? (
                  <TextButton label={t("today.seeAllTargets")} onPress={() => navigation.navigate("Activity")} />
                ) : undefined
              }
            />
            <Text style={styles.targetActual} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
              {formatTarget(headlineTarget.actual, headlineTarget.unit)}
            </Text>
            <Text style={styles.targetOf}>
              {t("today.ofTarget", { target: formatTarget(headlineTarget.target, headlineTarget.unit) })} ·{" "}
              {headlineTarget.completionPct}%
            </Text>
            <ProgressRow pct={headlineTarget.completionPct} tone="gold" />
            <Text style={styles.targetRemain}>
              {headlineTarget.completionPct < 8
                ? t("today.tooEarly")
                : t("today.remainingOf", { amount: formatTarget(headlineTarget.remaining, headlineTarget.unit) })}
            </Text>
          </Surface>
        ) : null}

        {celebrations.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {celebrations.map((achievement: any) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                onDismiss={() => dismissCelebration(achievement.id)}
              />
            ))}
          </View>
        ) : null}

        <View>
          <SectionHeader
            title={t("today.route")}
            action={route ? <TextButton label={t("today.viewRoute")} onPress={() => navigation.navigate("Route")} /> : undefined}
          />
          {route ? (
            <Surface>
              <View style={styles.between}>
                <Text style={styles.caption}>
                  {t("today.progress", {
                    done: route.progress.visited + route.progress.skipped,
                    total: route.progress.total,
                  })}
                </Text>
                <Text style={styles.pct}>{route.progress.completionPct}%</Text>
              </View>
              <ProgressRow pct={route.progress.completionPct} tone="green" />
              {hero?.kind === "route" ? (
                <Text style={styles.caption}>
                  {t("today.stopsRemaining", {
                    count: Math.max(0, route.progress.total - route.progress.visited - route.progress.skipped),
                  })}
                </Text>
              ) : nextStop ? (
                <>
                  <Text style={styles.nextName} numberOfLines={1}>
                    {nextStop.retailer.name}
                  </Text>
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label={t("today.openStore")}
                        icon="storefront-outline"
                        onPress={() =>
                          navigation.navigate("RepRetailerDetail", { retailerId: nextStop.retailer.id })
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SecondaryButton label={t("route.navigate")} icon="navigate-outline" onPress={() => navigateTo(nextStop)} />
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.caption}>{t("today.routeSettled")}</Text>
              )}
            </Surface>
          ) : (
            <Text style={styles.caption}>{t("today.noRouteBody")}</Text>
          )}
        </View>

        <View>
          <SectionHeader
            title={t("today.opportunities")}
            action={
              (today.opportunities?.actions?.length ?? 0) > 0 ? (
                <TextButton label={t("today.viewAll")} onPress={() => navigation.navigate("Opportunities")} />
              ) : undefined
            }
          />
          {attentionItems.length === 0 ? (
            <Text style={styles.caption}>{t("today.noCollectionsCalm")}</Text>
          ) : (
            <Surface>
              {attentionItems.map((item) => (
                <AttentionRow
                  key={item.key}
                  tone={item.source === "overdue" || item.type === "COLLECTION_DUE" ? "danger" : "gold"}
                  icon={
                    item.source === "overdue"
                      ? "wallet-outline"
                      : (OPPORTUNITY_ICONS[item.type ?? ""] ?? "bulb-outline")
                  }
                  title={item.title}
                  subtitle={
                    item.source === "overdue" && item.overdue != null
                      ? `${inr(item.overdue)} overdue`
                      : item.subtitle
                  }
                  onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: item.retailerId })}
                />
              ))}
            </Surface>
          )}
        </View>

        <View>
          <SectionHeader
            title={t("today.tasks")}
            action={
              remainingTasks.length > 0 ? (
                <Text style={styles.caption}>{t("today.tasksRemaining", { count: remainingTasks.length })}</Text>
              ) : undefined
            }
          />
          {today.tasks.length === 0 ? (
            <Text style={styles.caption}>{t("today.noTasksCalm")}</Text>
          ) : (
            <Surface>
              {today.tasks.slice(0, 5).map((task: any) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  subtitle={[
                    task.retailer?.name,
                    task.dueAt
                      ? `Due ${new Date(task.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  done={task.status === "done"}
                  overdue={task.overdue}
                  onComplete={() => void completeTask(task.id)}
                />
              ))}
            </Surface>
          )}
        </View>

        {(today.followUps ?? []).length > 0 ? (
          <View>
            <SectionHeader title={t("today.followUps")} />
            <Surface>
              {(today.followUps ?? []).map((followUp: any) => (
                <AttentionRow
                  key={followUp.id}
                  tone="warning"
                  icon="time-outline"
                  title={followUp.retailer?.name ?? "Customer"}
                  subtitle={followUp.notes ?? undefined}
                  onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: followUp.retailer?.id })}
                />
              ))}
            </Surface>
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  dayEyebrow: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, letterSpacing: 0.4, textTransform: "uppercase" },
  dayTitle: { fontSize: 22, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
  daySupport: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  heroName: { fontSize: 22, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
  heroAddress: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  heroNote: { fontSize: 13, fontWeight: "600", color: colors.danger },
  actions: { flexDirection: "row", gap: spacing.sm },
  targetActual: { fontSize: 32, fontWeight: "600", color: colors.ink, letterSpacing: -0.6 },
  targetOf: { fontSize: 13, color: colors.goldStrong, fontWeight: "600" },
  targetRemain: { fontSize: 13, color: colors.textSecondary },
  caption: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  pct: { fontSize: 13, fontWeight: "600", color: colors.primary },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextName: { fontSize: 16, fontWeight: "600", color: colors.ink, marginTop: spacing.sm },
});
