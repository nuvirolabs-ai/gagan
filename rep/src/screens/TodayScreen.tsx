import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import {
  Banner,
  Card,
  EmptyState,
  ListRow,
  MetricTile,
  PrimaryButton,
  ProgressTrack,
  ScreenHeader,
  SecondaryButton,
  SectionTitle,
  Tag,
} from "../components/ui";
import { useField } from "../context/FieldContext";
import { useRep } from "../context/RepContext";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { trackingBanner } from "../tracking/fieldTracker";
import { colors, inr, spacing, TAB_BAR_SPACE } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const TARGET_LABELS: Record<string, string> = {
  order_value: "Order value",
  visits: "Visits",
  collection_value: "Collections",
  new_customers: "New customers",
};

function duration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

export default function TodayScreen({ navigation }: any) {
  const { today, loading, error, refresh, tracking, outbox, startDay, endDay } = useField();
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

  const toggleDay = async () => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied") {
      return Alert.alert(
        "Location permission needed",
        reading.canAskAgain
          ? "Allow location while using the app so your day can be recorded."
          : "Turn on location access in Settings to start your day."
      );
    }
    if (reading.kind === "unavailable") {
      return Alert.alert("Location unavailable", reading.message);
    }
    setBusy(true);
    try {
      if (dayOpen) {
        await endDay(reading);
      } else {
        await startDay(reading);
      }
    } catch (err: any) {
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
    // Hand off to whichever maps app the phone uses, rather than embedding a
    // paid map provider in the app.
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`).catch(() =>
        Alert.alert("No maps app", "This phone has no app that can open directions.")
      )
    );
  };

  if (loading && !today) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={t("today.title")} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </View>
    );
  }

  if (!today) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={t("today.title")} />
        <EmptyState
          icon="calendar-blank-outline"
          title="Your day is not available"
          body={error ?? "Pull down to try again once you have a connection."}
          actionLabel={t("common.retry")}
          onAction={() => void refresh()}
        />
      </View>
    );
  }

  const banner = trackingBanner({
    tracking: tracking?.tracking ?? false,
    reason: tracking?.reason ?? "off_duty",
    pendingUploads: outbox.pending,
  });
  const route = today.route;
  const metrics = today.todayMetrics;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t("today.title")}
        subtitle={t("today.greeting", { name: staff?.name?.split(" ")[0] ?? "" })}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
        }
      >
        {error ? (
          <Banner tone="attention" title="Showing your last loaded day" body={error} icon="cloud-offline-outline" />
        ) : null}

        {/* Attendance — the switch the whole day hangs off. */}
        <Card>
          <View style={styles.dayRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayState}>
                {dayOpen
                  ? t("today.dayRunning", { duration: duration(attendance.minutesSoFar) })
                  : attendance.status === "closed"
                    ? t("today.dayEnded", { duration: duration(attendance.minutesSoFar) })
                    : t("today.dayNotStarted")}
              </Text>
              <Text style={styles.daySub}>
                {attendance.startedAt
                  ? `Started ${new Date(attendance.startedAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : "Start your day to share your route and record attendance."}
              </Text>
            </View>
            <Tag
              label={attendance.mark === "present" ? t("myday.present") : t("myday.absent")}
              tone={attendance.mark === "present" ? "green" : "neutral"}
            />
          </View>
          {attendance.status !== "closed" ? (
            <PrimaryButton
              label={dayOpen ? t("today.endDay") : t("today.startDay")}
              icon={dayOpen ? "stop-circle-outline" : "play-circle-outline"}
              tone={dayOpen ? "danger" : "green"}
              disabled={busy}
              onPress={() => void toggleDay()}
            />
          ) : null}
          <Banner tone={banner.tone} title={banner.title} body={banner.body} />
        </Card>

        {/* Today's numbers, from real orders, visits and collections. */}
        <Card>
          <SectionTitle title={t("today.title")} />
          <View style={styles.metrics}>
            <MetricTile label={t("today.metricVisits")} value={String(metrics.visits)} />
            <MetricTile label={t("today.metricOrders")} value={String(metrics.orders)} />
            <MetricTile
              label={t("today.metricOrderValue")}
              value={inr(metrics.orderValue)}
              tone="green"
            />
          </View>
          {today.targets.length > 0 ? (
            <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
              <Text style={styles.subhead}>{t("today.targets")}</Text>
              {today.targets.map((target: any) => (
                <View key={target.metric} style={{ gap: 5 }}>
                  <View style={styles.between}>
                    <Text style={styles.targetLabel}>
                      {TARGET_LABELS[target.metric] ?? target.metric}
                    </Text>
                    <Text style={styles.targetValue}>
                      {target.metric.includes("value")
                        ? `${inr(target.achieved)} / ${inr(target.target)}`
                        : `${target.achieved} / ${target.target}`}
                    </Text>
                  </View>
                  <ProgressTrack pct={target.achievementPct} />
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {/* Route */}
        <Card>
          <SectionTitle
            title={t("today.route")}
            action={
              route ? (
                <TouchableOpacity onPress={() => navigation.navigate("Route")}>
                  <Text style={styles.link}>{t("today.viewRoute")}</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
          {route ? (
            <>
              <View style={styles.between}>
                <Text style={styles.muted}>
                  {t("today.progress", {
                    done: route.progress.visited + route.progress.skipped,
                    total: route.progress.total,
                  })}
                </Text>
                <Text style={styles.pct}>{route.progress.completionPct}%</Text>
              </View>
              <ProgressTrack pct={route.progress.completionPct} />
              {route.nextStop ? (
                <View style={styles.nextStop}>
                  <Text style={styles.subhead}>{t("today.nextCustomer")}</Text>
                  <Text style={styles.nextName} numberOfLines={1}>
                    {route.nextStop.retailer.name}
                  </Text>
                  <Text style={styles.muted} numberOfLines={2}>
                    {route.nextStop.retailer.shopAddress}
                  </Text>
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Open store"
                        icon="storefront-outline"
                        onPress={() =>
                          navigation.navigate("RepRetailerDetail", {
                            retailerId: route.nextStop.retailer.id,
                          })
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SecondaryButton
                        label={t("route.navigate")}
                        icon="navigate-outline"
                        onPress={() => navigateTo(route.nextStop)}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.muted}>Every stop on today's route is settled.</Text>
              )}
            </>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={styles.dayState}>{t("today.noRoute")}</Text>
              <Text style={styles.muted}>{t("today.noRouteBody")}</Text>
            </View>
          )}
        </Card>

        {/* Tasks */}
        <Card>
          <SectionTitle title={t("today.tasks")} />
          {today.tasks.length === 0 ? (
            <Text style={styles.muted}>{t("today.noTasks")}</Text>
          ) : (
            today.tasks.slice(0, 5).map((task: any, index: number) => (
              <ListRow
                key={task.id}
                first={index === 0}
                icon={task.overdue ? "alert-circle-outline" : "checkbox-outline"}
                danger={task.overdue}
                title={task.title}
                subtitle={[
                  task.retailer?.name,
                  task.dueAt
                    ? `Due ${new Date(task.dueAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                right={
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => void completeTask(task.id)}
                    accessibilityLabel={`Mark ${task.title} done`}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.green} />
                  </TouchableOpacity>
                }
              />
            ))
          )}
        </Card>

        {/* Receivables the salesperson is expected to chase. */}
        <Card>
          <SectionTitle title={t("today.collections")} />
          {today.pendingCollections.retailers.length === 0 ? (
            <Text style={styles.muted}>{t("today.noCollections")}</Text>
          ) : (
            <>
              <View style={styles.between}>
                <Text style={styles.muted}>
                  {today.pendingCollections.retailers.length} customer
                  {today.pendingCollections.retailers.length === 1 ? "" : "s"}
                </Text>
                <Text style={styles.overdueTotal}>
                  {inr(today.pendingCollections.totalOverdue)} overdue
                </Text>
              </View>
              {today.pendingCollections.retailers.slice(0, 5).map((retailer: any, index: number) => (
                <ListRow
                  key={retailer.id}
                  first={index === 0}
                  icon="cash-outline"
                  title={retailer.name}
                  subtitle={retailer.shopAddress}
                  right={<Text style={styles.overdueTotal}>{inr(retailer.overdue)}</Text>}
                  onPress={() =>
                    navigation.navigate("RepRetailerDetail", { retailerId: retailer.id })
                  }
                />
              ))}
            </>
          )}
        </Card>

        {/* Follow-ups the salesperson promised a customer. */}
        {today.followUps.length > 0 ? (
          <Card>
            <SectionTitle title={t("today.followUps")} />
            {today.followUps.map((followUp: any, index: number) => (
              <ListRow
                key={followUp.id}
                first={index === 0}
                icon="time-outline"
                title={followUp.retailer?.name ?? "Customer"}
                subtitle={followUp.notes ?? undefined}
                onPress={() =>
                  navigation.navigate("RepRetailerDetail", { retailerId: followUp.retailer?.id })
                }
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: TAB_BAR_SPACE + spacing.xl },

  dayRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  dayState: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
  daySub: { fontSize: 12.5, color: colors.inkMuted, marginTop: 3, lineHeight: 18 },

  metrics: { flexDirection: "row", gap: spacing.sm },
  subhead: { fontSize: 12, fontWeight: "700", color: colors.inkMuted },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
  pct: { fontSize: 13, fontWeight: "700", color: colors.green },
  link: { fontSize: 12.5, fontWeight: "700", color: colors.green },

  targetLabel: { fontSize: 12.5, color: colors.ink, fontWeight: "600" },
  targetValue: { fontSize: 12.5, color: colors.inkMuted },

  nextStop: { gap: 4, marginTop: spacing.sm },
  nextName: { fontSize: 16, fontWeight: "700", color: colors.ink },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },

  doneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  overdueTotal: { fontSize: 13, fontWeight: "700", color: colors.danger },
});
