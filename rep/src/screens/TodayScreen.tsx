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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import TaskEvidenceSheet from "../components/TaskEvidenceSheet";
import {
  AppScreen,
  AttentionRow,
  EmptyState,
  FieldCompanionHeader,
  FocusCard,
  MetricStrip,
  OfflineBanner,
  PrimaryButton,
  ProgressRow,
  SecondaryButton,
  SectionHeader,
  Skeleton,
  Surface,
  TaskRow,
  TextButton,
  KeyboardSafeScrollView,
} from "../components/ui";
import { visibleAttentionItems } from "./attentionFeed";
import { haptic } from "../feedback/haptics";
import { useField } from "../context/FieldContext";
import { useRep } from "../context/RepContext";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { trackingBanner } from "../tracking/fieldTracker";
import { colors, inr, radius, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import { useLanguage } from "../i18n/LanguageContext";
import { homeAttendanceAction } from "./attendanceHomeAction";
import TeamTodaySection from "./TeamTodaySection";

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
  const isTargetComplete = achievement?.type === "TARGET_100";
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetBadge}>
            <Text style={styles.sheetBadgeText}>{milestone ? `${milestone}%` : "✓"}</Text>
          </View>
          <Text style={styles.sheetTitle}>{isTargetComplete ? "Target achieved" : isTargetMilestone ? `Strong work, ${name}` : achievement?.title || `Strong work, ${name}`}</Text>
          <Text style={styles.sheetMessage}>
            {isTargetComplete && target
              ? `${target} monthly target completed. Excellent work. Keep going.`
              : isTargetMilestone && milestone
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
        <Text style={styles.dayCompleteMeta}>{duration(minutes)} on the road · View activity</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

export default function TodayScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { today, celebrations, dismissCelebration, loading, error, refresh, tracking, outbox, startDay, endDay } = useField();
  const { staff } = useRep();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eodOpen, setEodOpen] = useState(false);
  const [managerNote, setManagerNote] = useState("");
  const [evidenceTask, setEvidenceTask] = useState<any | null>(null);

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

  const handleAttendancePress = () => {
    switch (homeAttendanceAction({ dayOpen, dayClosed })) {
      case "open_attendance":
        navigation.navigate("MyDay");
        return;
      case "end_day":
        setEodOpen(true);
        return;
      case "start_day":
        void toggleDay();
        return;
    }
  };

  const navigateTo = (stop: any) => {
    const { latitude, longitude, name } = stop.retailer;
    if (latitude == null || longitude == null) return Alert.alert("No saved location", "This store has no saved location yet. Open the store and capture it while you are there.");
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`).catch(() => Alert.alert("No maps app", "This phone has no app that can open directions.")));
  };

  if (loading && !today) {
    return (
      <AppScreen>
        <FieldCompanionHeader name={staff?.name ?? ""} />
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
        <FieldCompanionHeader name={staff?.name ?? ""} />
        <EmptyState icon="calendar-blank-outline" title="Your day is not available" body={error ?? "Pull down to try again once you have a connection."} actionLabel={t("common.retry")} onAction={() => void refresh()} />
      </AppScreen>
    );
  }

  const banner = trackingBanner({ tracking: tracking?.tracking ?? false, reason: tracking?.reason ?? "off_duty", pendingUploads: outbox.pending });
  const metrics = today.todayMetrics ?? {};
  const orderTarget = today.targets?.find((item: any) => item.metric === "order_value") ?? today.headlineTarget;
  const target = orderTarget;
  const hasConfiguredTarget = orderTarget != null && safeCount(orderTarget.target) > 0;

  // Monthly target from admin DB or standard FMCG benchmark ₹2,50,000
  const monthlyTarget = hasConfiguredTarget ? safeCount(orderTarget.target) : 250000;
  // Daily target (derived from monthly / 25 working days or configured)
  const dailyTarget = hasConfiguredTarget && (orderTarget as any).dailyTarget
    ? safeCount((orderTarget as any).dailyTarget)
    : Math.round(monthlyTarget / 25);

  const todaySales = safeCount(metrics.orderValue);
  const todayOrders = safeCount(metrics.orders);
  const todayPct = dailyTarget > 0 ? Math.round((todaySales / dailyTarget) * 100) : 0;
  const todayBarPct = Math.max(0, Math.min(100, todayPct));
  const todayRemaining = Math.max(0, dailyTarget - todaySales);
  const todayAchieved = todaySales >= dailyTarget && dailyTarget > 0;

  const monthSales = safeCount(
    today.monthMetrics?.orderValue ?? (hasConfiguredTarget ? orderTarget.actual : todaySales)
  );
  const monthOrders = safeCount(today.monthMetrics?.orders ?? todayOrders);
  const monthPct = monthlyTarget > 0 ? Math.round((monthSales / monthlyTarget) * 100) : 0;
  const monthBarPct = Math.max(0, Math.min(100, monthPct));
  const monthRemaining = Math.max(0, monthlyTarget - monthSales);
  const monthAchieved = monthSales >= monthlyTarget && monthlyTarget > 0;

  const pendingRetailers = today.pendingCollections?.retailers ?? [];
  const attentionItems = visibleAttentionItems({ overdueRetailers: pendingRetailers, accountReviews: today.pendingCollections?.reviewRetailers ?? [], opportunityActions: today.opportunities?.actions ?? [], serviceIssues: today.serviceIssues ?? [], followUps: today.followUps ?? [] });
  const remainingTasks = (today.tasks ?? []).filter((task: any) => task.status !== "done" && task.status !== "cancelled");

  return (
    <AppScreen>
      <FieldCompanionHeader
        name={staff?.name ?? ""}
        notificationCount={today.notifications?.length ?? 0}
        onNotifications={() => {
          if (!today.notifications?.length) {
            Alert.alert("Notifications", "You’re all caught up for now.");
            return;
          }
          const notif = today.notifications[0];
          Alert.alert(
            notif.title || "Dispatch Notification",
            notif.message,
            notif.orderId
              ? [
                  { text: "Dismiss", style: "cancel" },
                  {
                    text: "View Order",
                    onPress: () => navigation.navigate("OrderDetail", { orderId: notif.orderId }),
                  },
                ]
              : [{ text: "OK" }]
          );
        }}
      />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}>
        {error ? <OfflineBanner title={t("today.offline")} body={error || t("today.offlineBody")} /> : null}

        {/* Live Today Notifications (Order Cancellations & Dispatch Updates) */}
        {today.notifications?.map((notif: any) => (
          <Surface
            key={notif.id}
            style={{
              borderColor: notif.type === "order_cancelled" ? "#bbf7d0" : notif.type === "cancellation_declined" ? "#fed7aa" : "#fde68a",
              backgroundColor: notif.type === "order_cancelled" ? "#f0fdf4" : notif.type === "cancellation_declined" ? "#fff7ed" : "#fffbeb",
              padding: spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Ionicons
                name={notif.type === "order_cancelled" ? "checkmark-circle" : notif.type === "cancellation_declined" ? "alert-circle" : "time"}
                size={22}
                color={notif.type === "order_cancelled" ? "#16a34a" : notif.type === "cancellation_declined" ? "#ea580c" : "#ca8a04"}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>
                  {notif.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.inkMuted, marginTop: 2, lineHeight: 18 }}>
                  {notif.message}
                </Text>
                {notif.orderId ? (
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    <Pressable
                      onPress={() => navigation.navigate("OrderDetail", { orderId: notif.orderId })}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.blue }}>
                        View Order Details →
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </Surface>
        ))}

        {/* Today's Target vs Monthly Target Card */}
        <Surface style={styles.targetCard}>
          <View style={styles.targetCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.targetCardKicker}>SALES TARGETS & PROGRESS</Text>
              <Text style={styles.targetCardTitle}>Daily & Monthly Goals</Text>
            </View>
            <View style={styles.targetStatusBadge}>
              <Text style={styles.targetStatusBadgeText}>
                {hasConfiguredTarget ? "Admin Target" : "Standard Benchmark"}
              </Text>
            </View>
          </View>

          {/* Today's Target Section */}
          <View style={styles.targetSection}>
            <View style={styles.targetSectionHead}>
              <View style={styles.targetSectionLabelRow}>
                <View style={[styles.targetIconCircle, { backgroundColor: colors.blueSoft }]}>
                  <Ionicons name="flash-outline" size={15} color={colors.blueInk} />
                </View>
                <Text style={styles.targetSectionLabel}>TODAY’S TARGET</Text>
              </View>
              <View style={[styles.targetPctBadge, todayAchieved && styles.targetPctBadgeGreen]}>
                <Text style={[styles.targetPctText, todayAchieved && styles.targetPctTextGreen]}>
                  {todayPct}% DONE
                </Text>
              </View>
            </View>

            <View style={styles.targetNumbersRow}>
              <Text style={styles.targetActualBig}>{inr(todaySales)}</Text>
              <Text style={styles.targetGoalText}> / {inr(dailyTarget)}</Text>
            </View>

            <ProgressRow pct={todayBarPct} tone={todayAchieved ? "green" : "gold"} />

            <View style={styles.targetMetaRow}>
              {todayAchieved ? (
                <View style={styles.targetAchievedPill}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                  <Text style={styles.targetAchievedPillText}>
                    Daily target achieved! (+{inr(todaySales - dailyTarget)} ahead)
                  </Text>
                </View>
              ) : (
                <Text style={styles.targetMetaText}>
                  {inr(todayRemaining)} to go today · {todayOrders} order{todayOrders === 1 ? "" : "s"} booked
                </Text>
              )}
            </View>
          </View>

          <View style={styles.targetCardDivider} />

          {/* Monthly Target Section */}
          <View style={styles.targetSection}>
            <View style={styles.targetSectionHead}>
              <View style={styles.targetSectionLabelRow}>
                <View style={[styles.targetIconCircle, { backgroundColor: colors.limeSoft }]}>
                  <Ionicons name="trophy-outline" size={15} color={colors.green} />
                </View>
                <Text style={styles.targetSectionLabel}>MONTHLY TARGET</Text>
              </View>
              <View style={[styles.targetPctBadge, monthAchieved && styles.targetPctBadgeGreen]}>
                <Text style={[styles.targetPctText, monthAchieved && styles.targetPctTextGreen]}>
                  {monthPct}% DONE
                </Text>
              </View>
            </View>

            <View style={styles.targetNumbersRow}>
              <Text style={styles.targetActualBig}>{inr(monthSales)}</Text>
              <Text style={styles.targetGoalText}> / {inr(monthlyTarget)}</Text>
            </View>

            <ProgressRow pct={monthBarPct} tone={monthAchieved ? "green" : "gold"} />

            <View style={styles.targetMetaRow}>
              {monthAchieved ? (
                <View style={styles.targetAchievedPill}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                  <Text style={styles.targetAchievedPillText}>
                    Monthly target completed! Excellent work.
                  </Text>
                </View>
              ) : (
                <Text style={styles.targetMetaText}>
                  {inr(monthRemaining)} to reach monthly goal · {monthOrders} orders MTD
                </Text>
              )}
            </View>

            <MilestoneRail completion={monthPct} />
          </View>
        </Surface>

        {dayClosed ? (
          <CompactDayStatus minutes={attendance.minutesSoFar} onPress={() => navigation.navigate("Activity")} />
        ) : null}

        {attentionItems.length > 0 ? (
          <FocusCard tone="danger" style={styles.attentionFocus}>
            <View style={styles.attentionFocusHeader}>
              <View>
                <Text style={styles.attentionKicker}>NEEDS ATTENTION</Text>
                <Text style={styles.attentionFocusTitle}>One store needs a decision</Text>
              </View>
              <TextButton label="See all" onPress={() => navigation.navigate("Opportunities")} />
            </View>
            <AttentionRow
              tone="danger"
              icon={attentionItems[0].source === "overdue" ? "wallet-outline" : attentionItems[0].source === "reconciliation" ? "alert-circle-outline" : attentionItems[0].source === "follow_up" ? "time-outline" : attentionItems[0].source === "service_issue" ? "alert-circle-outline" : (OPPORTUNITY_ICONS[attentionItems[0].type ?? ""] ?? "bulb-outline")}
              title={attentionItems[0].title}
              subtitle={attentionItems[0].source === "reconciliation" ? t("finance.reviewTitle") : attentionItems[0].source === "overdue" && attentionItems[0].overdue != null ? `${inr(attentionItems[0].overdue)} overdue` : attentionItems[0].subtitle}
              onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: attentionItems[0].retailerId })}
            />
          </FocusCard>
        ) : null}

        <View>
          <SectionHeader title="Quick actions" />
          <View style={styles.actionSurface}>
            <ActionTile icon="calendar-outline" label="Attendance" onPress={handleAttendancePress} />
            <ActionTile icon="cart-outline" label="New Order" onPress={() => navigation.navigate("Retailers")} />
            <ActionTile icon="receipt-outline" label="My Orders" onPress={() => navigation.navigate("RepOrders")} />
            <ActionTile icon="cube-outline" label="Sales Kit" onPress={() => navigation.navigate("SalesKit")} />
            <ActionTile icon="ellipsis-horizontal" label="More" onPress={() => navigation.navigate("More")} />
          </View>
        </View>

        {remainingTasks.length > 0 ? (
          <View><SectionHeader title="Tasks" action={<Text style={styles.caption}>{remainingTasks.length} remaining</Text>} /><Surface>{(today.tasks ?? []).slice(0, 4).map((task: any) => <TaskRow key={task.id} title={task.title} subtitle={task.retailer?.name} done={task.status === "done"} overdue={task.overdue} onComplete={async () => { try { await repApi.setTaskStatus(task.id, "done"); haptic("success"); await refresh(); } catch { Alert.alert("Could not update the task", "Try again when you have a connection."); } }} trailing={task.retailer?.id ? <Pressable accessibilityRole="button" accessibilityLabel={`Task photos: ${task.title}`} hitSlop={8} onPress={() => setEvidenceTask(task)} style={styles.taskEvidenceButton}><Ionicons name="camera-outline" size={19} color={colors.blueInk} /></Pressable> : null} />)}</Surface></View>
        ) : null}

        {(today.followUps ?? []).length > 0 ? (
          <View>
            <SectionHeader title={t("today.followUps")} />
            <Surface>
              {(today.followUps ?? []).filter((followUp: any) => !attentionItems.some((item) => item.source === "follow_up" && item.key === `follow-up-${followUp.id}`)).map((followUp: any) => (
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

        {dayOpen ? <Surface style={styles.daySurface}><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>SALES DAY</Text><Text style={styles.dayTitle}>On duty since {formatClock(attendance.startedAt)}</Text><Text style={styles.caption}>{banner.body}</Text></View><TextButton label="End day" onPress={() => setEodOpen(true)} /></View></Surface> : null}
        {staff?.workspaceMode === "sales_leader" ? (
          <TeamTodaySection onOpen={() => navigation.navigate("Team")} />
        ) : null}
      </ScrollView>

      {eodOpen && dayOpen ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEodOpen(false)}>
          <View style={styles.sheetOverlay}>
            <KeyboardSafeScrollView containerStyle={styles.sheetKeyboard} contentContainerStyle={styles.sheetScroll}>
            <View style={[styles.eodSheet, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
              <View style={styles.between}><Text style={styles.sheetTitle}>End-of-day summary</Text><TextButton label="Close" onPress={() => setEodOpen(false)} /></View>
              <Text style={styles.sheetMessage}>Review your sales day before sending the handoff.</Text>
              <MetricStrip items={[{ label: "Visits", value: String(safeCount(metrics.visits)) }, { label: "Orders", value: String(safeCount(metrics.orders)) }, { label: "Order value", value: inr(safeCount(metrics.orderValue)) }]} />
              <Text style={styles.noteLabel}>Manager note <Text style={styles.optional}>Optional</Text></Text>
              <TextInput value={managerNote} onChangeText={setManagerNote} placeholder="Add a short handoff note" placeholderTextColor={colors.inkFaint} multiline maxLength={1000} style={styles.noteInput} />
              <View style={styles.heroActions}><View style={{ flex: 1 }}><SecondaryButton label="Keep working" onPress={() => setEodOpen(false)} /></View><View style={{ flex: 1 }}><PrimaryButton label="End My Day" icon="checkmark-circle-outline" tone="danger" disabled={busy} onPress={() => void toggleDay(managerNote)} /></View></View>
            </View>
            </KeyboardSafeScrollView>
          </View>
        </Modal>
      ) : null}

      <TaskEvidenceSheet
        visible={Boolean(evidenceTask)}
        task={evidenceTask}
        onClose={() => setEvidenceTask(null)}
        onChanged={() => void refresh()}
      />

      {celebrations[0] ? <AchievementSheet achievement={celebrations[0]} name={staff?.name?.split(" ")[0] ?? "there"} current={target?.unit === "currency" ? inr(safeCount(target.actual)) : target ? String(safeCount(target.actual)) : undefined} target={target?.unit === "currency" ? inr(safeCount(target.target)) : target ? String(safeCount(target.target)) : undefined} onDismiss={() => dismissCelebration(celebrations[0].id)} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  // React Navigation owns the normal-flow tab bar. Keep only a small final
  // content gap so the last action does not touch the visible bar.
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP },
  bellButton: { width: 44, height: 52, alignItems: "center", justifyContent: "center", position: "relative" },
  taskEvidenceButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.blueSoft },
  notificationDot: { position: "absolute", top: 12, right: 9, width: 7, height: 7, borderRadius: 99, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: colors.canvas },
  heroActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },

  targetCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  targetCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  targetCardKicker: {
    color: colors.inkMuted,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  targetCardTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  targetStatusBadge: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  targetStatusBadgeText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  targetSection: {
    gap: 6,
  },
  targetSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  targetSectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  targetIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  targetSectionLabel: {
    color: colors.inkMuted,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  targetPctBadge: {
    backgroundColor: colors.blueSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  targetPctBadgeGreen: {
    backgroundColor: colors.greenSoft,
  },
  targetPctText: {
    color: colors.blueInk,
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  targetPctTextGreen: {
    color: colors.green,
  },
  targetNumbersRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  targetActualBig: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  targetGoalText: {
    color: colors.inkMuted,
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  targetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  targetMetaText: {
    color: colors.inkMuted,
    fontSize: 12.5,
    lineHeight: 16,
  },
  targetAchievedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.limeSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  targetAchievedPillText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "700",
  },
  targetCardDivider: {
    height: 1,
    backgroundColor: colors.separator,
    marginVertical: spacing.xs,
  },
  eyebrow: { color: colors.inkMuted, fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2 },
  caption: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  milestoneRail: { flexDirection: "row", justifyContent: "space-between", gap: 6, paddingTop: spacing.xs },
  milestoneItem: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  milestoneItemPast: { backgroundColor: colors.limeSoft, borderColor: colors.limeSoft },
  milestoneItemCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  milestoneText: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  milestoneTextPast: { color: colors.green },
  milestoneTextCurrent: { color: colors.onDark },

  actionSurface: { flexDirection: "row", gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  actionTile: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: radius.md, paddingHorizontal: 4 },
  actionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: colors.inkMuted, fontSize: 10.5, fontWeight: "600", textAlign: "center" },
  attentionSurface: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  attentionFocus: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D", padding: spacing.lg, gap: spacing.sm },
  attentionFocusHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  attentionKicker: { color: colors.goldStrong, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  attentionFocusTitle: { color: colors.ink, fontSize: 14, fontWeight: "700", marginTop: 3 },
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
  sheetKeyboard: { flex: 1, justifyContent: "flex-end" },
  sheetScroll: { flexGrow: 1, justifyContent: "flex-end" },
  noteLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  optional: { color: colors.inkFaint, fontWeight: "400" },
  noteInput: { minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, textAlignVertical: "top", backgroundColor: colors.surfaceAlt },
});
