import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import ActivityComposer, { ACTIVITY_LABELS } from "../components/ActivityComposer";
import {
  AppScreen,
  Banner,
  Field,
  FocusCard,
  ListRow,
  OptionGrid,
  PrimaryButton,
  SectionTitle,
  Surface,
  Tag,
  inputStyle,
} from "../components/ui";
import { haptic } from "../feedback/haptics";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { colors, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const OUTCOMES = [
  { value: "order_placed", label: "Order placed" },
  { value: "payment_collected", label: "Payment collected" },
  { value: "follow_up_required", label: "Follow-up needed" },
  { value: "no_order", label: "No order" },
  { value: "issue_raised", label: "Issue raised" },
  { value: "shop_closed", label: "Shop closed" },
  { value: "decision_maker_unavailable", label: "Owner unavailable" },
  { value: "other", label: "Other" },
];

const VERIFICATION_COPY: Record<string, { tone: "active" | "idle" | "attention"; text: string }> = {
  VERIFIED: { tone: "active", text: "You're at the registered store." },
  NEEDS_REVIEW: { tone: "attention", text: "You're a little away from the store. This visit will be marked Needs review." },
  OUTSIDE_STORE_AREA: { tone: "attention", text: "You're outside the registered store area. This visit will be marked Needs review." },
  STORE_LOCATION_NOT_AVAILABLE: { tone: "idle", text: "This store has no verified location yet." },
  LOW_GPS_ACCURACY: { tone: "attention", text: "GPS accuracy was weak, so the distance check was skipped." },
};

/**
 * The workspace for a visit that is in progress: what happened, and how it
 * ended. It works on the single SalesVisit record created at check-in — closing
 * it out never creates a second visit.
 */
export default function VisitScreen({ route, navigation }: any) {
  const { visitId, retailerId, retailerName } = route.params;
  const { t } = useLanguage();
  const [visit, setVisit] = useState<any | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [visits, timeline] = await Promise.all([
      repApi.visits().catch(() => ({ visits: [] })),
      repApi.customerActivities(retailerId).catch(() => ({ activities: [] })),
    ]);
    setVisit((visits.visits ?? []).find((row: any) => row.id === visitId) ?? null);
    setActivities(
      (timeline.activities ?? []).filter((activity: any) => activity.visitId === visitId)
    );
  }, [retailerId, visitId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const checkOut = async () => {
    if (!outcome) {
      return Alert.alert("Pick an outcome", "Record how this visit ended before you check out.");
    }
    const reading = await captureForegroundLocation();
    if (reading.kind !== "captured") {
      return Alert.alert(
        "Location needed",
        reading.kind === "permission_denied"
          ? "Allow location while using the app to check out."
          : reading.message
      );
    }
    setSaving(true);
    try {
      await repApi.checkOut(visitId, {
        ...reading,
        outcome,
        notes: notes.trim() || undefined,
      });
      haptic("success");
      Alert.alert("Checked out", "This visit is closed and recorded against the customer.");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(
        "Could not check out",
        error?.message === "visit_already_checked_out"
          ? "This visit was already closed."
          : "Try again when you have a connection."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  const verification = visit ? VERIFICATION_COPY[visit.verificationStatus] : undefined;
  const closed = Boolean(visit?.checkedOutAt);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <FocusCard>
          <Text style={styles.title} numberOfLines={2}>
            {retailerName}
          </Text>
          {visit ? (
            <Text style={styles.muted}>
              {t("visit.checkedInAt", {
                time: new Date(visit.checkedInAt).toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
              {visit.distanceFromStoreMeters != null
                ? ` · ${Math.round(Number(visit.distanceFromStoreMeters))} m from the store`
                : ""}
            </Text>
          ) : null}
          {verification ? (
            <Banner
              tone={verification.tone}
              title={visit.verificationStatus === "VERIFIED" ? "Visit verified" : "Visit needs review"}
              body={verification.text}
            />
          ) : null}
          {closed ? <Tag label="Checked out" tone="green" /> : null}
        </FocusCard>

        <Surface>
          <SectionTitle title={t("visit.activities")} />
          {activities.length === 0 ? (
            <Text style={styles.muted}>{t("visit.noActivities")}</Text>
          ) : (
            activities.map((activity, index) => (
              <ListRow
                key={activity.id}
                first={index === 0}
                icon="checkmark-circle-outline"
                title={ACTIVITY_LABELS[activity.type] ?? activity.type}
                subtitle={activity.notes ?? undefined}
              />
            ))
          )}
          {!closed ? (
            composing ? (
              <ActivityComposer
                retailerId={retailerId}
                visitId={visitId}
                onCancel={() => setComposing(false)}
                onLogged={() => {
                  setComposing(false);
                  void load();
                }}
              />
            ) : (
              <PrimaryButton
                label={t("visit.logActivity")}
                icon="add-circle-outline"
                onPress={() => setComposing(true)}
              />
            )
          ) : null}
        </Surface>

        {!closed ? (
          <Surface>
            <SectionTitle title={t("visit.outcome")} />
            <OptionGrid options={OUTCOMES} value={outcome} onChange={setOutcome} />
            <Field label={t("visit.notes")} hint={t("common.optional")}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything your manager should know"
                placeholderTextColor={colors.inkFaint}
                style={[inputStyle, { minHeight: 72, textAlignVertical: "top" }]}
                multiline
              />
            </Field>
            <PrimaryButton
              label={saving ? t("common.submitting") : t("visit.finish")}
              icon="log-out-outline"
              disabled={saving}
              onPress={() => void checkOut()}
            />
          </Surface>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: spacing.xxl },
  title: { fontSize: 22, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
});
