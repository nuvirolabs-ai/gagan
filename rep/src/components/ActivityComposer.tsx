import React, { useState } from "react";
import { Alert, Text, TextInput, View, StyleSheet } from "react-native";

import { Field, OptionGrid, PrimaryButton, SecondaryButton, inputStyle } from "./ui";
import DatePickerModal from "./DatePickerModal";
import { addDays, formatIsoDay, isoDay } from "./dateHelpers";
import { useField } from "../context/FieldContext";
import { colors, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * The controlled activity vocabulary, mirroring the server's enum. The type is
 * what reporting reads; the note is for the salesperson.
 */
export const ACTIVITY_TYPES = [
  { value: "order_discussion", label: "Order discussion" },
  { value: "order_placed", label: "Order placed" },
  { value: "payment_discussion", label: "Payment discussion" },
  { value: "collection_completed", label: "Collection done" },
  { value: "product_demo", label: "Product demo" },
  { value: "stock_check", label: "Stock check" },
  { value: "merchandising", label: "Merchandising" },
  { value: "complaint_raised", label: "Complaint" },
  { value: "follow_up_required", label: "Follow-up needed" },
  { value: "competitor_observation", label: "Competitor seen" },
  { value: "no_order", label: "No order" },
  { value: "shop_closed", label: "Shop closed" },
  { value: "decision_maker_unavailable", label: "Owner unavailable" },
  { value: "note", label: "Note" },
];

export const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_TYPES.map((type) => [type.value, type.label])
);

const FOLLOW_UP_OPTIONS = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "2_days", label: "In 2 days" },
  { value: "3_days", label: "In 3 days" },
  { value: "7_days", label: "In 7 days" },
  { value: "custom", label: "Choose date" },
];

/**
 * Logs one structured activity against a customer, optionally inside a visit.
 * Works offline: an activity that cannot be sent is queued on the phone and the
 * salesperson is told so rather than being shown a false success.
 */
export default function ActivityComposer({
  retailerId,
  visitId,
  onLogged,
  onCancel,
}: {
  retailerId: string;
  visitId?: string;
  onLogged?: () => void;
  onCancel?: () => void;
}) {
  const { logActivity } = useField();
  const { t } = useLanguage();
  const [type, setType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [followUpMode, setFollowUpMode] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState(() => addDays(isoDay(new Date()), 2));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!type) return Alert.alert("Pick what happened", "Choose an activity type to log.");
    setSaving(true);
    try {
      const followUpAt = followUpMode
        ? new Date(`${followUpDate}T09:00:00.000Z`).toISOString()
        : undefined;
      const result = await logActivity({
        retailerId,
        type,
        visitId,
        notes: notes.trim() || undefined,
        followUpAt,
      });
      setType(null);
      setNotes("");
      setFollowUpMode(null);
      setFollowUpDate(addDays(isoDay(new Date()), 2));
      onLogged?.();
      Alert.alert(
        t("activity.logged"),
        result === "queued" ? t("activity.queued") : "Saved to this customer's history."
      );
    } catch (error: any) {
      Alert.alert("Could not log this", error?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Field label={t("activity.type")}>
        <OptionGrid options={ACTIVITY_TYPES} value={type} onChange={setType} />
      </Field>
      <Field label={t("visit.notes")} hint={t("common.optional")}>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="What did the owner say?"
          placeholderTextColor={colors.inkFaint}
          style={[inputStyle, { minHeight: 72, textAlignVertical: "top" }]}
          multiline
        />
      </Field>
      <Field label="Follow-up date" hint={followUpMode ? `Scheduled for ${formatIsoDay(followUpDate, { weekday: "short", day: "numeric", month: "short" })}` : "Optional — keep a clear next step"}>
        <OptionGrid
          options={FOLLOW_UP_OPTIONS}
          value={followUpMode}
          onChange={(value) => {
            setFollowUpMode(value);
            if (value === "tomorrow") setFollowUpDate(addDays(isoDay(new Date()), 1));
            if (value === "2_days") setFollowUpDate(addDays(isoDay(new Date()), 2));
            if (value === "3_days") setFollowUpDate(addDays(isoDay(new Date()), 3));
            if (value === "7_days") setFollowUpDate(addDays(isoDay(new Date()), 7));
            if (value === "custom") setDatePickerOpen(true);
          }}
        />
      </Field>
      <View style={styles.actions}>
        {onCancel ? (
          <View style={{ flex: 1 }}>
            <SecondaryButton label={t("common.cancel")} onPress={onCancel} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label={saving ? t("common.submitting") : t("visit.logActivity")}
            disabled={saving}
            onPress={() => void submit()}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        Activities are saved to this customer's history and to your own activity timeline.
      </Text>
      <DatePickerModal
        visible={datePickerOpen}
        value={followUpDate}
        title="Follow-up date"
        onChange={setFollowUpDate}
        onClose={() => setDatePickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm },
  hint: { fontSize: 11.5, color: colors.inkFaint, lineHeight: 16 },
});
