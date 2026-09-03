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
import { colors, greetingForHour, inr, radius, spacing, TAB_BAR_SPACE } from "../theme";
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
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ActionTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}>
      <View style={styles.actionIcon}><Ionicons name={icon as any} size={21} color={colors.blue} /></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function MilestoneRail({ completion }: { completion: number }) {
  return (
    <View style={styles.milestoneRail} accessibilityLabel={`Target progress ${completion}%`}>
      {MILESTONES.map((milestone) => {
        const active = completion >= milestone;
        return (
          <View key={milestone} style={styles.milestoneItem}>
            <View style={[styles.milestoneDot, active && styles.milestoneDotActive]}>
              {active ? <Ionicons name="checkmark" size={13} color={colors.ink} /> : null}
            </View>
            <Text style={[styles.milestoneText, active && styles.milestoneTextActive]}>{milestone}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function AchievementSheet({ achievement, name, onDismiss }: { achievement: any; name: string; onDismiss: () => void }) {
  const match = String(achievement?.type ?? "").match(/(25|50|75|80|90|100)/);
  const milestone = match?.[1] ?? "";
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetBadge}><Text style={styles.sheetBadgeText}>{milestone ? `${milestone}%` : "✓"}</Text></View>
          <Text style={styles.sheetTitle}>{achievement?.title || `Strong work, ${name}`}</Text>
          <Text style={styles.sheetMessage}>{achievement?.message || "You reached an important point in your current target."}</Text>
          <PrimaryButton label="Keep going" onPress={onDismiss} />
          <TextButton label="Dismiss" onPress={onDismiss} />
        </View>
      </View>
    </Modal>
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

  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

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
      } else { await startDay(reading); haptic("medium"); }
    } catch (err: any) {
      haptic("warning");
      Alert.alert(dayOpen ? "Could not end your day" : "Could not start your day", err?.message === "workday_already_completed" ? "You have already completed today's attendance." : err?.message === "attendance_photo_required" ? "Your organisation requires an attendance photo. Ask your administrator to enable photo capture in the app." : "Try again when you have a connection.");
    } finally { setBusy(false); }
  };

  const navigateTo = (stop: any) => {
    const { latitude, longitude, name } = stop.retailer;
    if (latitude == null || longitude == null) return Alert.alert("No saved location", "This store has no saved location yet. Open the store and capture it while you are there.");
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`).catch(() => Alert.alert("No maps app", "This phone has no app that can open directions.")));
  };

  const salutation = greetingForHour(new Date().getHours()) === "morning" ? t("today.goodMorning") : greetingForHour(new Date().getHours()) === "afternoon" ? t("today.goodAfternoon") : t("today.goodEvening");

  if (loading && !today) {
    return <AppScreen><PersonalGreeting name={staff?.name ?? ""} salutation={salutation} dateLabel={formatLongDate()} /><View style={styles.pad}><Skeleton height={164} radius={24} /><View style={{ height: spacing.section }} /><Skeleton height={176} radius={20} /></View></AppScreen>;
  }
  if (!today) {
    return <AppScreen><PersonalGreeting name={staff?.name ?? ""} salutation={salutation} dateLabel={formatLongDate()} /><EmptyState icon="calendar-blank-outline" title="Your day is not available" body={error ?? "Pull down to try again once you have a connection."} actionLabel={t("common.retry")} onAction={() => void refresh()} /></AppScreen>;
  }

  const banner = trackingBanner({ tracking: tracking?.tracking ?? false, reason: tracking?.reason ?? "off_duty", pendingUploads: outbox.pending });
  const route = today.route;
  const metrics = today.todayMetrics ?? {};
  const target = today.headlineTarget;
  const nextStop = route?.nextStop;
  const pendingRetailers = today.pendingCollections?.retailers ?? [];
  const attentionItems = visibleAttentionItems({ overdueRetailers: pendingRetailers, opportunityActions: today.opportunities?.actions ?? [] });
  const remainingTasks = (today.tasks ?? []).filter((task: any) => task.status !== "done" && task.status !== "cancelled");
  const planned = safeCount(route?.progress?.total);
  const visited = safeCount(route?.progress?.visited) + safeCount(route?.progress?.skipped);
  const completion = Math.max(0, Math.min(100, safeCount(target?.completionPct)));

  return (
    <AppScreen>
      <PersonalGreeting
        name={staff?.name ?? ""}
        salutation={dayClosed ? t("today.niceWork") : salutation}
        dateLabel={formatLongDate()}
        right={(today.notifications?.length ?? 0) > 0 ? <Pressable accessibilityLabel="Notifications" style={styles.bellButton}><Ionicons name="notifications-outline" size={22} color={colors.ink} /></Pressable> : null}
      />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}>
        {error ? <OfflineBanner title={t("today.offline")} body={error || t("today.offlineBody")} /> : null}

        {!dayClosed && nextStop ? (
          <View style={styles.hero}>
            <View style={styles.heroTop}><Text style={styles.heroEyebrow}>{dayOpen ? "NEXT VISIT" : "TODAY'S PLAN"}</Text><View style={styles.heroPill}><Text style={styles.heroPillText}>{dayOpen ? "NEXT" : "OPEN DAY"}</Text></View></View>
            <Text style={styles.heroSequence}>STOP {nextStop.sequence} · {nextStop.purpose?.replace(/_/g, " ")}</Text>
            <Text style={styles.heroName} numberOfLines={2}>{nextStop.retailer.name}</Text>
            <Text style={styles.heroAddress} numberOfLines={2}>{nextStop.retailer.shopAddress}</Text>
            <View style={styles.heroMeta}><Ionicons name="location-outline" size={16} color={colors.onDarkMuted} /><Text style={styles.heroMetaText}>{nextStop.retailer.locationStatus === "VERIFIED" ? "Verified store location" : "Store location needs review"}</Text></View>
            <View style={styles.heroActions}><View style={{ flex: 1 }}><PrimaryButton label={dayOpen ? "Start visit" : "Open store"} icon="navigate-circle-outline" onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: nextStop.retailer.id, startVisit: dayOpen })} /></View><View style={styles.heroNavigate}><SecondaryButton label="Navigate" icon="navigate-outline" onPress={() => navigateTo(nextStop)} /></View></View>
          </View>
        ) : (
          <Surface style={styles.calmHero}><Text style={styles.eyebrow}>FIELD DAY</Text><Text style={styles.calmTitle}>{dayClosed ? "Day complete" : "No next visit assigned"}</Text><Text style={styles.caption}>{dayClosed ? `You worked ${duration(attendance.minutesSoFar)} today.` : banner.body}</Text>{dayClosed ? <TextButton label={t("today.seeActivity")} onPress={() => navigation.navigate("Activity")} /> : null}</Surface>
        )}

        {!dayClosed ? <Surface style={styles.salesSurface}>
          <View style={styles.between}><View><Text style={styles.eyebrow}>TODAY'S SALES</Text><Text style={styles.salesValue}>{inr(safeCount(metrics.orderValue))}</Text></View><View style={styles.salesTargetBox}><Text style={styles.targetLabel}>CURRENT TARGET</Text><Text style={styles.targetValue}>{target ? `${target.completionPct}%` : "—"}</Text></View></View>
          <View style={styles.targetRule} />
          {target ? <><View style={styles.between}><Text style={styles.caption}>{target.label || "Current target"}</Text><Text style={styles.caption}>{target.sentence}</Text></View><ProgressRow pct={completion} tone="gold" /><Text style={styles.targetPeriod}>{target.periodStart && target.periodEnd ? `${new Date(target.periodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — ${new Date(target.periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Configured target period"}</Text><MilestoneRail completion={completion} /></> : <Text style={styles.caption}>No target has been configured for this period.</Text>}
        </Surface> : null}

        <View style={styles.quietMetricStrip}><View style={styles.quietMetric}><Text style={styles.quietMetricValue}>{safeCount(metrics.visits)}</Text><Text style={styles.quietMetricLabel}>Visits</Text></View><View style={styles.quietMetric}><Text style={styles.quietMetricValue}>{safeCount(metrics.productiveVisits)}</Text><Text style={styles.quietMetricLabel}>Productive</Text></View><View style={styles.quietMetric}><Text style={styles.quietMetricValue}>{safeCount(metrics.orders)}</Text><Text style={styles.quietMetricLabel}>Orders</Text></View><View style={styles.quietMetric}><Text style={[styles.quietMetricValue, { color: colors.green }]}>{inr(safeCount(metrics.collectionValueConfirmed))}</Text><Text style={styles.quietMetricLabel}>Collected</Text></View></View>

        <View><SectionHeader title="Today's route" action={route ? <TextButton label="Full plan" onPress={() => navigation.navigate("Route")} /> : undefined} />{route ? <Surface style={styles.routeSurface}><View style={styles.routeProgressLine}><Text style={styles.caption}>{visited} of {planned} stops complete</Text><Text style={styles.routePct}>{safeCount(route.progress.completionPct)}%</Text></View><ProgressRow pct={safeCount(route.progress.completionPct)} tone="green" />{(route.stops ?? []).slice(0, 4).map((stop: any, index: number) => <Pressable key={stop.id} onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: stop.retailer.id })} style={({ pressed }) => [styles.stopRow, pressed && styles.pressed]}><View style={[styles.stopNumber, stop.status === "visited" && styles.stopNumberDone]}>{stop.status === "visited" ? <Ionicons name="checkmark" size={13} color={colors.onDark} /> : <Text style={styles.stopNumberText}>{index + 1}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.stopName} numberOfLines={1}>{stop.retailer.name}</Text><Text style={styles.stopAddress} numberOfLines={1}>{stop.retailer.shopAddress}</Text></View><Text style={[styles.stopStatus, stop.status === "visited" && { color: colors.green }]}>{stop.status === "visited" ? "DONE" : stop.id === nextStop?.id ? "NEXT" : "PLANNED"}</Text></Pressable>)}</Surface> : <Text style={styles.caption}>{t("today.noRouteBody")}</Text>}</View>

        <View><SectionHeader title="Quick actions" /><Surface style={styles.actionSurface}><ActionTile icon="calendar-outline" label="Attendance" onPress={() => (dayOpen ? setEodOpen(true) : void toggleDay())} /><ActionTile icon="cart-outline" label="Order" onPress={() => nextStop ? navigation.navigate("RepRetailerDetail", { retailerId: nextStop.retailer.id }) : navigation.navigate("Retailers")} /><ActionTile icon="cube-outline" label="Sales Kit" onPress={() => navigation.navigate("SalesKit")} /><ActionTile icon="ellipsis-horizontal" label="More" onPress={() => navigation.navigate("More")} /></Surface></View>

        {attentionItems.length > 0 ? <View><SectionHeader title="Needs attention" action={<TextButton label="See all" onPress={() => navigation.navigate("Opportunities")} />} /><Surface>{attentionItems.slice(0, 4).map((item) => <AttentionRow key={item.key} tone={item.source === "overdue" || item.type === "COLLECTION_DUE" ? "danger" : "gold"} icon={item.source === "overdue" ? "wallet-outline" : (OPPORTUNITY_ICONS[item.type ?? ""] ?? "bulb-outline")} title={item.title} subtitle={item.source === "overdue" && item.overdue != null ? `${inr(item.overdue)} overdue` : item.subtitle} onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: item.retailerId })} />)}</Surface></View> : null}

        {remainingTasks.length > 0 ? <View><SectionHeader title="Tasks" action={<Text style={styles.caption}>{remainingTasks.length} remaining</Text>} /><Surface>{(today.tasks ?? []).slice(0, 4).map((task: any) => <TaskRow key={task.id} title={task.title} subtitle={task.retailer?.name} done={task.status === "done"} overdue={task.overdue} onComplete={async () => { try { await repApi.setTaskStatus(task.id, "done"); haptic("success"); await refresh(); } catch { Alert.alert("Could not update the task", "Try again when you have a connection."); } }} />)}</Surface></View> : null}

        {dayOpen ? <Surface style={styles.daySurface}><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>FIELD DAY</Text><Text style={styles.dayTitle}>On duty since {formatClock(attendance.startedAt)}</Text><Text style={styles.caption}>{banner.body}</Text></View><TextButton label="End day" onPress={() => setEodOpen(true)} /></View></Surface> : null}
      </ScrollView>

      {eodOpen && dayOpen ? <Modal visible transparent animationType="slide" onRequestClose={() => setEodOpen(false)}><View style={styles.sheetOverlay}><View style={styles.eodSheet}><View style={styles.between}><Text style={styles.sheetTitle}>End-of-day summary</Text><TextButton label="Close" onPress={() => setEodOpen(false)} /></View><Text style={styles.sheetMessage}>Review your field day before sending the handoff.</Text><MetricStrip items={[{ label: "Visits", value: String(safeCount(metrics.visits)) }, { label: "Orders", value: String(safeCount(metrics.orders)) }, { label: "Order value", value: inr(safeCount(metrics.orderValue)) }]} /><Text style={styles.noteLabel}>Manager note <Text style={styles.optional}>Optional</Text></Text><TextInput value={managerNote} onChangeText={setManagerNote} placeholder="Add a short handoff note" placeholderTextColor={colors.inkFaint} multiline maxLength={1000} style={styles.noteInput} /><View style={styles.heroActions}><View style={{ flex: 1 }}><SecondaryButton label="Keep working" onPress={() => setEodOpen(false)} /></View><View style={{ flex: 1 }}><PrimaryButton label="End My Day" icon="checkmark-circle-outline" tone="danger" disabled={busy} onPress={() => void toggleDay(managerNote)} /></View></View></View></View></Modal> : null}
      {celebrations[0] ? <AchievementSheet achievement={celebrations[0]} name={staff?.name?.split(" ")[0] ?? "there"} onDismiss={() => dismissCelebration(celebrations[0].id)} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  content: { paddingHorizontal: spacing.xl, gap: 18, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  bellButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: colors.navy, borderRadius: radius.hero, padding: spacing.xl, gap: spacing.sm },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroEyebrow: { color: colors.onDarkMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  heroPill: { backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  heroPillText: { color: colors.onDark, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroSequence: { color: colors.blueMid, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 9 },
  heroName: { color: colors.onDark, fontSize: 25, fontWeight: "700", letterSpacing: -0.5, marginTop: 1 },
  heroAddress: { color: colors.onDarkMuted, fontSize: 14, lineHeight: 20 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  heroMetaText: { color: colors.onDarkMuted, fontSize: 12.5 },
  heroActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  heroNavigate: { flex: 0.78 },
  calmHero: { gap: spacing.sm, paddingVertical: spacing.xl },
  eyebrow: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  calmTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  caption: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  salesSurface: { gap: spacing.md },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  salesValue: { color: colors.ink, fontSize: 34, fontWeight: "700", letterSpacing: -1 },
  salesTargetBox: { alignItems: "flex-end" },
  targetLabel: { color: colors.inkMuted, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8 },
  targetValue: { color: colors.blue, fontSize: 23, fontWeight: "800", marginTop: 3 },
  targetRule: { height: 1, backgroundColor: colors.border },
  targetPeriod: { color: colors.inkFaint, fontSize: 11.5 },
  milestoneRail: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.sm, paddingHorizontal: 3 },
  milestoneItem: { alignItems: "center", gap: 5 },
  milestoneDot: { width: 27, height: 27, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  milestoneDotActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  milestoneText: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  milestoneTextActive: { color: colors.ink },
  quietMetricStrip: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md },
  quietMetric: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 4 },
  quietMetricValue: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  quietMetricLabel: { color: colors.inkMuted, fontSize: 11.5, textAlign: "center" },
  routeSurface: { gap: spacing.sm },
  routeProgressLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  routePct: { color: colors.blue, fontSize: 13, fontWeight: "800" },
  stopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  stopNumber: { width: 27, height: 27, borderRadius: radius.pill, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  stopNumberDone: { backgroundColor: colors.green },
  stopNumberText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  stopName: { color: colors.ink, fontSize: 14.5, fontWeight: "700" },
  stopAddress: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  stopStatus: { color: colors.blue, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  actionSurface: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  actionTile: { flex: 1, minHeight: 82, alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 4 },
  actionIcon: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: colors.ink, fontSize: 11.5, fontWeight: "700", textAlign: "center" },
  daySurface: { backgroundColor: colors.blueSoft },
  dayTitle: { color: colors.ink, fontSize: 16, fontWeight: "700", marginTop: 4 },
  pressed: { opacity: 0.72 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(8, 15, 28, 0.52)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: spacing.xl, paddingTop: 34, paddingBottom: 30, alignItems: "center", gap: spacing.md },
  sheetBadge: { width: 100, height: 100, borderRadius: 30, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  sheetBadgeText: { color: colors.ink, fontSize: 30, fontWeight: "800" },
  sheetTitle: { color: colors.ink, fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  sheetMessage: { color: colors.inkMuted, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 340 },
  eodSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl, gap: spacing.md },
  noteLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  optional: { color: colors.inkFaint, fontWeight: "400" },
  noteInput: { minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, textAlignVertical: "top" },
});
