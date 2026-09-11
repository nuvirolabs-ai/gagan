import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import {
  Card,
  Field,
  ListRow,
  OptionGrid,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  Tag,
  inputStyle,
} from "../components/ui";
import DatePickerModal from "../components/DatePickerModal";
import { formatIsoDay, isoDay as isoDayValue, monthGrid, monthStart, parseIsoDay, shiftMonth } from "../components/dateHelpers";
import { repApi } from "../api/repClient";
import { colors, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const LEAVE_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "sick", label: "Sick" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

const MARK_TONE: Record<string, "green" | "gold" | "danger" | "neutral"> = {
  present: "green",
  leave: "gold",
  absent: "danger",
  holiday: "neutral",
  not_due: "neutral",
};

const LEAVE_STATUS_TONE: Record<string, "green" | "gold" | "danger" | "neutral"> = {
  approved: "green",
  pending: "gold",
  rejected: "danger",
  cancelled: "neutral",
};

const LEAVE_STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  cancelled: "Withdrawn",
};

function isoDay(value: Date) {
  return isoDayValue(value);
}

/** Accepts YYYY-MM-DD only; anything else is rejected before it is sent. */
function parseDay(value: string): Date | null {
  return parseIsoDay(value);
}

export default function MyDayScreen() {
  const { t } = useLanguage();
  const [days, setDays] = useState<any[]>([]);
  const [leave, setLeave] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState(isoDay(new Date()));
  const [toDate, setToDate] = useState(isoDay(new Date()));
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [datePicker, setDatePicker] = useState<"from" | "to" | null>(null);
  const [leaveType, setLeaveType] = useState("casual");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const monthFrom = isoDayValue(month);
    const monthTo = isoDayValue(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)));
    const [attendance, requests] = await Promise.all([
      repApi.attendance(monthFrom, monthTo).catch(() => ({ days: [] })),
      repApi.leaveRequests().catch(() => ({ requests: [] })),
    ]);
    setDays([...attendance.days].reverse());
    setLeave(requests.requests);
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const cells = useMemo(() => monthGrid(month), [month]);

  const submitLeave = async () => {
    const from = parseDay(fromDate);
    const to = parseDay(toDate);
    if (!from || !to) {
      return Alert.alert("Check the dates", "Use the format YYYY-MM-DD, for example 2026-03-10.");
    }
    if (to < from) {
      return Alert.alert("Check the dates", "The last day cannot be before the first day.");
    }
    if (reason.trim().length < 3) {
      return Alert.alert("Add a reason", "Your manager needs a reason to decide on this request.");
    }
    setSaving(true);
    try {
      await repApi.requestLeave({
        fromDate: from.toISOString(),
        toDate: to.toISOString(),
        type: leaveType,
        reason: reason.trim(),
      });
      setComposing(false);
      setReason("");
      await load();
      Alert.alert("Request sent", "Your manager will see this in the back office.");
    } catch (error: any) {
      Alert.alert(
        "Could not send the request",
        error?.message === "leave_overlaps_existing_request"
          ? "You already have a request covering those dates."
          : "Try again when you have a connection."
      );
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    Alert.alert("Withdraw this leave request?", "Your manager will no longer see it as pending.", [
      { text: "Keep request", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: async () => {
        try {
          await repApi.cancelLeave(id);
          await load();
        } catch {
          Alert.alert("Could not withdraw", "Only a request that is still pending can be withdrawn.");
        }
      } },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  const worked = days.filter((day) => day.mark === "present").length;
  const leaveForDay = (date: string) =>
    leave.find((request) => request.fromDate?.slice(0, 10) <= date && request.toDate?.slice(0, 10) >= date);
  const attendanceForDay = (date: string) => days.find((day) => day.date === date);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.blue}
          />
        }
      >
        <Card>
          <SectionTitle
            title="Attendance calendar"
            action={
              <View style={styles.monthActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((current) => shiftMonth(current, -1))} hitSlop={8}>
                  <Ionicons name="chevron-back" size={18} color={colors.inkMuted} />
                </Pressable>
                <Text style={styles.monthLabel}>{month.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth((current) => shiftMonth(current, 1))} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
                </Pressable>
              </View>
            }
          />
          <View style={styles.weekRow}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {cells.map((date, index) => {
              const attendance = date ? attendanceForDay(date) : undefined;
              const request = date ? leaveForDay(date) : undefined;
              const marked = attendance?.mark === "present";
              const leaveMarked = request?.status === "approved" || request?.status === "pending";
              return date ? (
                <Pressable key={date} accessibilityRole="button" accessibilityLabel={formatIsoDay(date, { weekday: "long", day: "numeric", month: "long" })} onPress={() => setFromDate(date)} style={styles.calendarDay}>
                  <View style={[styles.dayDot, marked && styles.presentDot, leaveMarked && styles.leaveDot, request?.status === "rejected" && styles.rejectedDot]}>
                    <Text style={[styles.dayNumber, (marked || leaveMarked) && styles.dayNumberMarked]}>{Number(date.slice(-2))}</Text>
                  </View>
                </Pressable>
              ) : <View key={`empty-${index}`} style={styles.calendarDay} />;
            })}
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>● Present</Text>
            <Text style={styles.legendText}>● Leave</Text>
            <Text style={styles.legendText}>○ Absent / not marked</Text>
          </View>
          <Text style={styles.muted}>{worked} day{worked === 1 ? "" : "s"} present in this month. Tap a date to use it as the leave start date.</Text>
        </Card>

        <Card>
          <SectionTitle title={t("myday.attendance")} />
          <Text style={styles.muted}>
            {worked} day{worked === 1 ? "" : "s"} present in the last {days.length} days.
          </Text>
          {days.slice(0, 30).map((day, index) => (
            <ListRow
              key={day.date}
              first={index === 0}
              title={new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              subtitle={
                day.startedAt
                  ? `${new Date(day.startedAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}${
                      day.endedAt
                        ? ` – ${new Date(day.endedAt).toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}`
                        : " · still running"
                    }`
                  : undefined
              }
              right={
                <Tag
                  label={
                    day.mark === "present"
                      ? t("myday.present")
                      : day.mark === "leave"
                        ? t("myday.onLeave")
                        : day.mark === "holiday"
                          ? t("myday.holiday")
                          : day.mark === "not_due"
                            ? "—"
                            : t("myday.absent")
                  }
                  tone={MARK_TONE[day.mark] ?? "neutral"}
                />
              }
            />
          ))}
        </Card>

        <Card>
          <SectionTitle title={t("myday.leave")} />
          {leave.length === 0 ? (
            <Text style={styles.muted}>{t("myday.noLeave")}</Text>
          ) : (
            leave.map((request, index) => (
              <ListRow
                key={request.id}
                first={index === 0}
                icon="calendar-outline"
                title={`${new Date(request.fromDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })} – ${new Date(request.toDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}`}
                subtitle={`${request.type} · ${request.reason}${
                  request.decisionNote ? ` · ${request.decisionNote}` : ""
                }`}
                right={
                  <Tag
                    label={LEAVE_STATUS_LABEL[request.status] ?? request.status}
                    tone={LEAVE_STATUS_TONE[request.status] ?? "neutral"}
                  />
                }
                onPress={request.status === "pending" ? () => void cancel(request.id) : undefined}
              />
            ))
          )}
          {composing ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Field label={t("myday.leaveFrom")} hint="YYYY-MM-DD">
                <Pressable style={styles.dateInput} onPress={() => setDatePicker("from")}><Text style={styles.dateInputText}>{formatIsoDay(fromDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text><Ionicons name="calendar-outline" size={18} color={colors.primary} /></Pressable>
              </Field>
              <Field label={t("myday.leaveTo")} hint="YYYY-MM-DD">
                <Pressable style={styles.dateInput} onPress={() => setDatePicker("to")}><Text style={styles.dateInputText}>{formatIsoDay(toDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text><Ionicons name="calendar-outline" size={18} color={colors.primary} /></Pressable>
              </Field>
              <Field label={t("myday.leave")}>
                <OptionGrid options={LEAVE_TYPES} value={leaveType} onChange={setLeaveType} />
              </Field>
              <Field label={t("myday.leaveReason")}>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Family function in the village"
                  placeholderTextColor={colors.inkFaint}
                  style={inputStyle}
                  multiline
                />
              </Field>
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label={t("common.cancel")} onPress={() => setComposing(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={saving ? t("common.submitting") : t("myday.leaveSubmit")}
                    disabled={saving}
                    onPress={() => void submitLeave()}
                  />
                </View>
              </View>
            </View>
          ) : (
            <SecondaryButton
              label={t("myday.requestLeave")}
              icon="add-circle-outline"
              onPress={() => setComposing(true)}
            />
          )}
        </Card>
      </ScrollView>
      <DatePickerModal
        visible={datePicker !== null}
        value={datePicker === "to" ? toDate : fromDate}
        title={datePicker === "to" ? "Leave ends" : "Leave starts"}
        onChange={(value) => datePicker === "to" ? setToDate(value) : setFromDate(value)}
        onClose={() => setDatePicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: spacing.xxl },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
  actions: { flexDirection: "row", gap: spacing.sm },
  monthActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  monthLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: spacing.xs },
  weekday: { flex: 1, textAlign: "center", color: colors.inkFaint, fontSize: 10, fontWeight: "700" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.xs },
  calendarDay: { width: "14.2857%", height: 36, alignItems: "center", justifyContent: "center" },
  dayDot: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  presentDot: { backgroundColor: colors.greenSoft },
  leaveDot: { backgroundColor: colors.goldSoft },
  rejectedDot: { borderWidth: 1, borderColor: colors.danger },
  dayNumber: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  dayNumberMarked: { color: colors.ink },
  legend: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, flexWrap: "wrap" },
  legendText: { color: colors.inkMuted, fontSize: 10.5 },
  dateInput: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateInputText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
});
