import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Accepts YYYY-MM-DD only; anything else is rejected before it is sent. */
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const [leaveType, setLeaveType] = useState("casual");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const [attendance, requests] = await Promise.all([
      repApi.attendance().catch(() => ({ days: [] })),
      repApi.leaveRequests().catch(() => ({ requests: [] })),
    ]);
    setDays([...attendance.days].reverse());
    setLeave(requests.requests);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

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
    try {
      await repApi.cancelLeave(id);
      await load();
    } catch {
      Alert.alert("Could not cancel", "Only a request that is still pending can be cancelled.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  const worked = days.filter((day) => day.mark === "present").length;

  return (
    <View style={styles.screen}>
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
                    label={request.status}
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
                <TextInput
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="2026-03-10"
                  placeholderTextColor={colors.inkFaint}
                  style={inputStyle}
                  autoCapitalize="none"
                />
              </Field>
              <Field label={t("myday.leaveTo")} hint="YYYY-MM-DD">
                <TextInput
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="2026-03-11"
                  placeholderTextColor={colors.inkFaint}
                  style={inputStyle}
                  autoCapitalize="none"
                />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
  actions: { flexDirection: "row", gap: spacing.sm },
});
