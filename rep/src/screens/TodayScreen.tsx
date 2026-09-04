import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import {
  AppScreen,
  AttentionRow,
  EmptyState,
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
import { visibleAttentionItems } from "./attentionFeed";
import { haptic } from "../feedback/haptics";
import { useField } from "../context/FieldContext";
import { useRep } from "../context/RepContext";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { trackingBanner } from "../tracking/fieldTracker";
import { colors, greetingForHour, inr, radius, spacing } from "../theme";
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

const MILESTONES = [25, 50, 75, 90, 100];

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
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stopTime(stop: any): string {
  const structuredTime = formatClock(stop?.plannedAt ?? stop?.scheduledAt ?? stop?.visitAt ?? stop?.time);
  if (structuredTime) return structuredTime;
  // RoutePlanStop currently stores the planned visit time in its existing
  // operator note. Reading it here is presentation-only; the route contract
  // and stop state remain untouched until the backend exposes a structured
  // scheduling field.
  return String(stop?.note ?? "").match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? "";
}

function ActionTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon as any} size={21} color={colors.blueInk} />
      </View>
      <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{label}</Text>
    </Pressable>
  );
}

function MilestoneRail({ completion }: { completion: number }) {
  const highestReached = [...MILESTONES].reverse().find((milestone) => completion >= milestone);
  return (
    <View style={styles.milestoneRail} accessibilityLabel={`Target progress ${completion}%`}>
      {MILESTONES.map((milestone) => {
        const reached = completion >= milestone;
        const current = reached && milestone === highestReached;
        return (
          <View
            key={milestone}
            style={[
              styles.milestoneItem,
              reached && styles.milestoneItemPast,
              current && styles.milestoneItemCurrent,
            ]}
          >
            <Text style={[styles.milestoneText, reached && styles.milestoneTextPast, current && styles.milestoneTextCurrent]}>{milestone}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function TargetBlock({
  label,
  value,
  detail,
  pct,
  pctLabel,
}: {
  label: string;
  value: string;
  detail: string;
  pct?: number;
  pctLabel?: string;
}) {
  const bounded = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.targetBlock}>
      <View style={styles.targetBlockHead}>
        <Text style={styles.targetBlockLabel}>{label}</Text>
        {pct != null ? <Text style={styles.targetBlockPct}>{pctLabel ?? `${pct}%`}</Text> : null}
      </View>
      <ProgressRow pct={bounded} tone="green" />
      <Text style={styles.targetBlockDetail} numberOfLines={1}>{detail}</Text>
      <Text style={styles.targetBlockValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{value}</Text>
    </View>
  );
}

function AchievementSheet({
  achievement,
  name,
  current,
  target,
  onDismiss,
}: {
  achievement: any;
  name: string;
  current?: string;
  target?: string;
  onDismiss: () => void;
}) {
  const match = String(achievement?.type ?? "").match(/(25|50|75|80|90|100)/);
  const milestone = match?.[1] ?? "";
  const isTargetMilestone = String(achievement?.type ?? "").startsWith("TARGET_");
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetBadge}>
            <Text style={styles.sheetBadgeText}>{milestone ? `${milestone}%` : "✓"}</Text>
          </View>
          <Text style={styles.sheetTitle}>{isTargetMilestone ? `Strong work, ${name}` : achievement?.title || `Strong work, ${name}`}</Text>
          <Text style={styles.sheetMessage}>
            {isTargetMilestone && milestone
              ? `You just reached ${milestone}% of this period’s target. ${achievement?.message ?? ""}`
              : achievement?.message || "You just reached an important point of your target."}
          </Text>
          {current && target ? <Text style={styles.sheetAmount}>{current} · target {target}</Text> : null}
          <PrimaryButton label="Keep going" tone="navy" onPress={onDismiss} />
          <TextButton label="Dismiss" onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

function CompactDayStatus({ minutes, onPress }: { minutes: number | null | undefined; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Day complete. View activity."
      onPress={onPress}
      style={({ pressed }) => [styles.dayCompleteRow, pressed && styles.pressed]}
    >
      <View style={styles.dayCompleteMark}>
        <Ionicons name="checkmark" size={18} color={colors.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.dayCompleteTitle}>Day complete</Text>
        <Text style={styles.dayCompleteMeta}>{duration(minutes)} in field · View activity</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

export default function TodayScreen({ navigation }: any) {
  const { today, celebrations, dismissCelebration, loading, error, refresh, tracking, outbox, startDay, endDay } = useField();
  const { staff } = useRep();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eodOpen, setEodOpen] = useState(false);
  const [managerNote, setManagerNote] = useState("");

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const attendance = today?.attendance;
  const dayOpen = attendance?.status === "open";
  const dayClosed = attendance?.status === "closed";

  const toggleDay = async (note?: string) => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied") {
      haptic("warning");
      return Alert.alert("Location permission needed", reading.canAskAgain ? "Allow location while using the app so your day can be recorded." : "Turn on location access in Settings to start your day.");
    }
    if (reading.kind === "unavailable") { haptic("warning"); return Alert.alert("Location unavailable", reading.message); }
    setBusy(true);
    try {
      if (dayOpen) {
        await endDay({ ...reading, managerNote: note?.trim() || undefined });
        haptic("success"); setEodOpen(false); setManagerNote("");
      } else {
        await startDay(reading);
        haptic("medium");
      }
    } catch (err: any) {
      haptic("warning");
      Alert.alert(dayOpen ? "Could not end your day" : "Could not start your day", err?.message === "workday_already_completed" ? "You have already completed today's attendance." : err?.message === "attendance_photo_required" ? "Your organisation requires an attendance photo. Ask your administrator to enable photo capture in the app." : "Try again when you have a connection.");
    } finally {
      setBusy(false);
    }
  };

  const navigateTo = (stop: any) => {
    const { latitude, longitude, name } = stop.retailer;
    if (latitude == null || longitude == null) return Alert.alert("No saved location", "This store has no saved location yet. Open the store and capture it while you are there.");
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`).catch(() => Alert.alert("No maps app", "This phone has no app that can open directions.")));
  };

  const salutation = greetingForHour(new Date().getHours()) === "morning" ? t("today.goodMorning") : greetingForHour(new Date().getHours()) === "afternoon" ? t("today.goodAfternoon") : t("today.goodEvening");

  if (loading && !today) {
    return (
      <AppScreen>
        <PersonalGreeting name={staff?.name ?? ""} salutation={salutation} dateLabel={formatLongDate()} />
        <View style={styles.pad}>
          <Skeleton height={170} radius={radius.hero} />
          <View style={{ height: spacing.section }} />
          <Skeleton height={214} radius={radius.xl} />
        </View>
      </AppScreen>
    );
  }

  if (!today) {
    return (
      <AppScreen>
        <PersonalGreeting name={staff?.name ?? ""} salutation={salutation} dateLabel={formatLongDate()} />
        <EmptyState icon="calendar-blank-outline" title="Your day is not available" body={error ?? "Pull down to try again once you have a connection."} actionLabel={t("common.retry")} onAction={() => void refresh()} />
      </AppScreen>
    );
  }

  const banner = trackingBanner({ tracking: tracking?.tracking ?? false, reason: tracking?.reason ?? "off_duty", pendingUploads: outbox.pending });
  const route = today.route;
  const metrics = today.todayMetrics ?? {};
  const target = today.targets?.find((item: any) => item.metric === "order_value") ?? today.headlineTarget;
  const nextStop = route?.nextStop;
  const pendingStops = safeCount(route?.progress?.pending);
  const pendingRetailers = today.pendingCollections?.retailers ?? [];
  const attentionItems = visibleAttentionItems({ overdueRetailers: pendingRetailers, opportunityActions: today.opportunities?.actions ?? [] });
  const remainingTasks = (today.tasks ?? []).filter((task: any) => task.status !== "done" && task.status !== "cancelled");
  const planned = safeCount(route?.progress?.total);
  const visited = safeCount(route?.progress?.visited) + safeCount(route?.progress?.skipped);
  const completion = Math.max(0, Math.min(100, safeCount(target?.completionPct)));
  const targetActual = target?.unit === "currency" ? inr(safeCount(target.actual)) : String(safeCount(target?.actual));
  const targetTotal = target?.unit === "currency" ? inr(safeCount(target.target)) : String(safeCount(target?.target));
  const targetProgressDetail = target
    ? safeCount(target.remaining) > 0
      ? target.unit === "currency"
        ? `${inr(safeCount(target.remaining))} to go`
        : `${safeCount(target.remaining)} to go`
      : "Target reached"
    : "Target progress";
  const coverage = planned > 0 ? Math.round((safeCount(metrics.customersCovered) / planned) * 100) : null;
  const statusLabel = dayClosed ? "Day complete" : `${pendingStops} stop${pendingStops === 1 ? "" : "s"} left · ${dayOpen ? "on track" : "ready to start"}`;

  return (
    <AppScreen>
      <PersonalGreeting
        name={staff?.name ?? ""}
        salutation={salutation}
        statusLabel={statusLabel}
        dateLabel={formatLongDate()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={styles.bellButton}
            onPress={() => Alert.alert("Notifications", today.notifications?.length ? `${today.notifications.length} notification${today.notifications.length === 1 ? "" : "s"} available.` : "You’re all caught up for now.")}
          >
            <Ionicons name="notifications-outline" size={23} color={colors.ink} />
            {(today.notifications?.length ?? 0) > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}>
        {error ? <OfflineBanner title={t("today.offline")} body={error || t("today.offlineBody")} /> : null}

        {!dayClosed && nextStop ? (
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{stopTime(nextStop) ? `NEXT · ${stopTime(nextStop)}` : "NEXT STOP"}</Text>
              </View>
              <Ionicons name="navigate-outline" size={21} color={colors.onDarkMuted} />
            </View>
            <Text style={styles.heroMetaTop}>STOP {nextStop.sequence} · {nextStop.purpose?.replace(/_/g, " ")}</Text>
            <Text style={styles.heroName} numberOfLines={2}>{nextStop.retailer.name}</Text>
            <Text style={styles.heroAddress} numberOfLines={2}>{nextStop.retailer.shopAddress}</Text>
            {nextStop.retailer.locationStatus ? (
              <View style={styles.heroLocation}>
                <Ionicons name="location-outline" size={15} color={colors.onDarkMuted} />
                <Text style={styles.heroLocationText}>{nextStop.retailer.locationStatus === "VERIFIED" ? "Verified store location" : "Store location needs review"}</Text>
              </View>
            ) : null}
            <View style={styles.heroActions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label={dayOpen ? "Start visit" : "Open store"} icon="navigate-circle-outline" onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: nextStop.retailer.id, startVisit: dayOpen })} />
              </View>
              <SecondaryButton variant="text" label="Navigate" icon="navigate-outline" onPress={() => navigateTo(nextStop)} />
            </View>
          </View>
        ) : dayClosed ? (
          <CompactDayStatus minutes={attendance.minutesSoFar} onPress={() => navigation.navigate("Activity")} />
        ) : (
          <Surface style={styles.calmHero}>
            <View style={styles.calmHeroContent}>
              <View style={styles.calmHeroMark}><Ionicons name="calendar-outline" size={20} color={colors.blueInk} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>FIELD DAY</Text>
                <Text style={styles.calmTitle}>No next visit assigned</Text>
                <Text style={styles.caption}>{banner.body}</Text>
              </View>
            </View>
          </Surface>
        )}

        <Surface style={styles.salesSurface}>
          <View style={styles.salesHeading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>TODAY’S SALES</Text>
              <Text style={styles.salesValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{inr(safeCount(metrics.orderValue))}</Text>
            </View>
            <View style={styles.salesContext}>
              <Text style={styles.contextLabel}>{target ? "MONTH TARGET" : "TARGET"}</Text>
              <Text style={[styles.contextValue, !target && styles.contextValueQuiet]}>{target ? `${completion}%` : "—"}</Text>
            </View>
          </View>
          {target ? (
            <>
              <View style={styles.targetGrid}>
                <TargetBlock label={target.label || "Monthly sales"} value={`${targetActual} / ${targetTotal}`} detail={targetProgressDetail} pct={completion} />
                <View style={styles.targetDivider} />
                <TargetBlock label={safeCount(target.remaining) > 0 ? "To go" : "Target"} value={safeCount(target.remaining) > 0 ? (target.unit === "currency" ? inr(safeCount(target.remaining)) : String(safeCount(target.remaining))) : "Done"} detail={safeCount(target.remaining) > 0 ? (target.periodStart && target.periodEnd ? `${new Date(target.periodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — ${new Date(target.periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Configured target period") : "Target reached"} pct={safeCount(target.remaining) > 0 ? Math.max(0, 100 - completion) : 100} pctLabel={safeCount(target.remaining) > 0 ? `${Math.max(0, 100 - completion)}% left` : "Done"} />
              </View>
              <MilestoneRail completion={completion} />
            </>
          ) : (
            <View style={styles.targetUnavailable}><Ionicons name="flag-outline" size={18} color={colors.inkMuted} /><Text style={styles.caption}>No target has been configured for this period.</Text></View>
          )}
        </Surface>

          <View style={styles.metricStrip}>
            <View style={styles.metricCell}><Text style={styles.metricValue}>{safeCount(metrics.visits)}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.metricLabel}>Visits</Text></View>
            <View style={styles.metricCell}><Text style={styles.metricValue}>{visited}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.metricLabel}>Done</Text></View>
            <View style={styles.metricCell}><Text style={styles.metricValue}>{coverage == null ? "—" : `${coverage}%`}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.metricLabel}>Coverage</Text></View>
        </View>

        <View>
          <SectionHeader title="Today’s route" action={route ? <TextButton label="Full plan" onPress={() => navigation.navigate("Route")} /> : undefined} />
          {route ? (
            <Surface style={styles.routeSurface}>
              <View style={styles.routeProgressLine}><Text style={styles.caption}>{visited} of {planned} stops complete</Text><Text style={styles.routePct}>{safeCount(route.progress.completionPct)}%</Text></View>
              <ProgressRow pct={safeCount(route.progress.completionPct)} tone="green" />
              {(route.stops ?? []).slice(0, 4).map((stop: any) => {
                const visitedStop = stop.status === "visited";
                const skipped = stop.status === "skipped";
                return (
                  <Pressable key={stop.id} onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: stop.retailer.id })} style={({ pressed }) => [styles.stopRow, pressed && styles.pressed]}>
                    <View style={styles.stopTimeCol}><Text style={styles.stopTime}>{stopTime(stop) || `#${stop.sequence}`}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.stopName} numberOfLines={1}>{stop.retailer.name}</Text><Text style={styles.stopAddress} numberOfLines={1}>{stop.retailer.shopAddress}</Text></View>
                    <Text style={[styles.stopStatus, visitedStop && styles.stopStatusDone, skipped && styles.stopStatusSkipped]}>{visitedStop ? "DONE" : skipped ? "SKIPPED" : stop.id === nextStop?.id ? "NEXT" : "PLANNED"}</Text>
                  </Pressable>
                );
              })}
            </Surface>
          ) : <Text style={styles.caption}>{t("today.noRouteBody")}</Text>}
        </View>

        <View>
          <SectionHeader title="Quick actions" />
          <View style={styles.actionSurface}>
            <ActionTile icon="calendar-outline" label="Attendance" onPress={() => (dayOpen ? setEodOpen(true) : void toggleDay())} />
            <ActionTile icon="cart-outline" label="Order" onPress={() => nextStop ? navigation.navigate("RepRetailerDetail", { retailerId: nextStop.retailer.id }) : navigation.navigate("Retailers")} />
            <ActionTile icon="cube-outline" label="Sales Kit" onPress={() => navigation.navigate("SalesKit")} />
            <ActionTile icon="ellipsis-horizontal" label="More" onPress={() => navigation.navigate("More")} />
          </View>
        </View>

        {attentionItems.length > 0 ? (
          <View><SectionHeader title="Needs attention" action={<TextButton label="See all" onPress={() => navigation.navigate("Opportunities")} />} /><Surface style={styles.attentionSurface}>{attentionItems.slice(0, 4).map((item) => <AttentionRow key={item.key} tone={item.source === "overdue" || item.type === "COLLECTION_DUE" ? "danger" : "gold"} icon={item.source === "overdue" ? "wallet-outline" : (OPPORTUNITY_ICONS[item.type ?? ""] ?? "bulb-outline")} title={item.title} subtitle={item.source === "overdue" && item.overdue != null ? `${inr(item.overdue)} overdue` : item.subtitle} onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: item.retailerId })} />)}</Surface></View>
        ) : null}

        {remainingTasks.length > 0 ? (
          <View><SectionHeader title="Tasks" action={<Text style={styles.caption}>{remainingTasks.length} remaining</Text>} /><Surface>{(today.tasks ?? []).slice(0, 4).map((task: any) => <TaskRow key={task.id} title={task.title} subtitle={task.retailer?.name} done={task.status === "done"} overdue={task.overdue} onComplete={async () => { try { await repApi.setTaskStatus(task.id, "done"); haptic("success"); await refresh(); } catch { Alert.alert("Could not update the task", "Try again when you have a connection."); } }} />)}</Surface></View>
        ) : null}

        {dayOpen ? <Surface style={styles.daySurface}><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>FIELD DAY</Text><Text style={styles.dayTitle}>On duty since {formatClock(attendance.startedAt)}</Text><Text style={styles.caption}>{banner.body}</Text></View><TextButton label="End day" onPress={() => setEodOpen(true)} /></View></Surface> : null}
      </ScrollView>

      {eodOpen && dayOpen ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEodOpen(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.eodSheet}>
              <View style={styles.between}><Text style={styles.sheetTitle}>End-of-day summary</Text><TextButton label="Close" onPress={() => setEodOpen(false)} /></View>
              <Text style={styles.sheetMessage}>Review your field day before sending the handoff.</Text>
              <MetricStrip items={[{ label: "Visits", value: String(safeCount(metrics.visits)) }, { label: "Orders", value: String(safeCount(metrics.orders)) }, { label: "Order value", value: inr(safeCount(metrics.orderValue)) }]} />
              <Text style={styles.noteLabel}>Manager note <Text style={styles.optional}>Optional</Text></Text>
              <TextInput value={managerNote} onChangeText={setManagerNote} placeholder="Add a short handoff note" placeholderTextColor={colors.inkFaint} multiline maxLength={1000} style={styles.noteInput} />
              <View style={styles.heroActions}><View style={{ flex: 1 }}><SecondaryButton label="Keep working" onPress={() => setEodOpen(false)} /></View><View style={{ flex: 1 }}><PrimaryButton label="End My Day" icon="checkmark-circle-outline" tone="danger" disabled={busy} onPress={() => void toggleDay(managerNote)} /></View></View>
            </View>
          </View>
        </Modal>
      ) : null}

      {celebrations[0] ? <AchievementSheet achievement={celebrations[0]} name={staff?.name?.split(" ")[0] ?? "there"} current={target?.unit === "currency" ? inr(safeCount(target.actual)) : target ? String(safeCount(target.actual)) : undefined} target={target?.unit === "currency" ? inr(safeCount(target.target)) : target ? String(safeCount(target.target)) : undefined} onDismiss={() => dismissCelebration(celebrations[0].id)} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  // AppScreen reserves the measured tab-bar height. Adding TAB_BAR_SPACE here
  // as well created the large blank/dead region below the final section.
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: spacing.xl },
  bellButton: { width: 44, height: 52, alignItems: "center", justifyContent: "center", position: "relative" },
  notificationDot: { position: "absolute", top: 12, right: 9, width: 7, height: 7, borderRadius: 99, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: colors.canvas },

  hero: { backgroundColor: colors.navy, borderRadius: radius.hero, padding: spacing.xl, gap: spacing.sm },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBadge: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start" },
  heroBadgeText: { color: colors.navy, fontSize: 12, fontWeight: "800", letterSpacing: 0.25 },
  heroMetaTop: { color: colors.onDarkMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.md },
  heroName: { color: colors.onDark, fontSize: 27, lineHeight: 32, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  heroAddress: { color: colors.onDarkMuted, fontSize: 15, lineHeight: 21 },
  heroLocation: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
  heroLocationText: { color: colors.onDarkMuted, fontSize: 12.5 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  calmHero: { gap: spacing.md, minHeight: 96, paddingVertical: spacing.lg },
  calmHeroContent: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  calmHeroMark: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.inkMuted, fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2 },
  calmTitle: { color: colors.ink, fontSize: 21, fontWeight: "800", letterSpacing: -0.3, marginTop: 3 },
  caption: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },

  salesSurface: { gap: spacing.md, paddingVertical: spacing.lg },
  salesHeading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  salesValue: { color: colors.ink, fontSize: 32, lineHeight: 37, fontWeight: "700", letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  salesContext: { alignItems: "flex-end", paddingTop: 2 },
  contextLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  contextValue: { color: colors.blue, fontSize: 20, fontWeight: "700", marginTop: 4, fontVariant: ["tabular-nums"] },
  contextValueQuiet: { color: colors.inkFaint },
  targetGrid: { flexDirection: "row", gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  targetBlock: { flex: 1, minWidth: 0, gap: 6 },
  targetDivider: { width: 1, backgroundColor: colors.separator, marginVertical: 2 },
  targetBlockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  targetBlockLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.55, flex: 1 },
  targetBlockPct: { color: colors.blueInk, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  targetBlockDetail: { color: colors.inkMuted, fontSize: 11, lineHeight: 15 },
  targetBlockValue: { color: colors.ink, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  targetUnavailable: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  milestoneRail: { flexDirection: "row", justifyContent: "space-between", gap: 6, paddingTop: spacing.xs },
  milestoneItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  milestoneItemPast: { backgroundColor: colors.limeSoft, borderColor: colors.limeSoft },
  milestoneItemCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  milestoneText: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  milestoneTextPast: { color: colors.green },
  milestoneTextCurrent: { color: colors.onDark },

  metricStrip: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md },
  metricCell: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: spacing.xs },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  metricLabel: { color: colors.inkMuted, fontSize: 11.5, textAlign: "center", width: "100%" },

  routeSurface: { gap: spacing.sm },
  routeProgressLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  routePct: { color: colors.blueInk, fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  stopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, minHeight: 58 },
  // Keep the full HH:MM token on one line on narrow Android devices. The
  // route is an itinerary, so a wrapped time is materially harder to scan.
  stopTimeCol: { width: 52 },
  stopTime: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  stopName: { color: colors.ink, fontSize: 14.5, fontWeight: "700" },
  stopAddress: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  stopStatus: { color: colors.blueInk, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  stopStatusDone: { color: colors.green },
  stopStatusSkipped: { color: colors.warning },

  actionSurface: { flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  actionTile: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: radius.md, paddingHorizontal: 4 },
  actionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: colors.inkMuted, fontSize: 10.5, fontWeight: "600", textAlign: "center" },
  attentionSurface: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  dayCompleteRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dayCompleteMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  dayCompleteTitle: { color: colors.ink, fontSize: 15.5, fontWeight: "700" },
  dayCompleteMeta: { color: colors.inkMuted, fontSize: 12.5, marginTop: 2 },
  daySurface: { backgroundColor: colors.blueSoft },
  dayTitle: { color: colors.ink, fontSize: 16, fontWeight: "700", marginTop: 4 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  pressed: { opacity: 0.72 },

  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(8, 15, 28, 0.54)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: spacing.xl, paddingTop: 34, paddingBottom: 30, alignItems: "center", gap: spacing.md },
  sheetBadge: { width: 102, height: 102, borderRadius: 32, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sheetBadgeText: { color: colors.onDark, fontSize: 34, fontWeight: "800", fontVariant: ["tabular-nums"] },
  sheetTitle: { color: colors.ink, fontSize: 26, lineHeight: 31, fontWeight: "800", textAlign: "center", letterSpacing: -0.55 },
  sheetMessage: { color: colors.inkMuted, fontSize: 15.5, lineHeight: 22, textAlign: "center", maxWidth: 350 },
  sheetAmount: { color: colors.ink, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  eodSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: spacing.xl, gap: spacing.md },
  noteLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  optional: { color: colors.inkFaint, fontWeight: "400" },
  noteInput: { minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, textAlignVertical: "top", backgroundColor: colors.surfaceAlt },
});
