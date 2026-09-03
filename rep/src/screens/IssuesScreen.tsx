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

export const ISSUE_TYPES = [
  { value: "damaged_product", label: "Damaged product" },
  { value: "delivery_issue", label: "Delivery issue" },
  { value: "invoice_issue", label: "Invoice issue" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "quality_complaint", label: "Quality complaint" },
  { value: "service_request", label: "Service request" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUS_TONE: Record<string, "green" | "gold" | "danger" | "neutral"> = {
  open: "gold",
  in_progress: "gold",
  resolved: "green",
  closed: "neutral",
  rejected: "danger",
};

/**
 * Customer service issues raised from the field. Raising one also writes a
 * `complaint_raised` activity on the customer's timeline, so the store's
 * history stays complete without a second entry from the salesperson.
 */
export default function IssuesScreen({ route }: any) {
  const presetRetailer = route?.params?.retailerId as string | undefined;
  const presetRetailerName = route?.params?.retailerName as string | undefined;
  const { t } = useLanguage();
  const [issues, setIssues] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(Boolean(presetRetailer));
  const [saving, setSaving] = useState(false);
  const [retailerId, setRetailerId] = useState<string | null>(presetRetailer ?? null);
  const [type, setType] = useState<string | null>(null);
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    const [issueList, retailerList] = await Promise.all([
      repApi.issues().catch(() => ({ issues: [] })),
      presetRetailer ? Promise.resolve({ retailers: [] }) : repApi.retailers().catch(() => ({ retailers: [] })),
    ]);
    setIssues(issueList.issues ?? []);
    setRetailers(retailerList.retailers ?? []);
  }, [presetRetailer]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const submit = async () => {
    if (!retailerId) return Alert.alert("Pick a customer", "Choose which store this is about.");
    if (!type) return Alert.alert("Pick a type", "Choose what kind of issue this is.");
    if (description.trim().length < 3) {
      return Alert.alert("Add a description", "Describe the problem so the team can act on it.");
    }
    setSaving(true);
    try {
      await repApi.raiseIssue({
        retailerId,
        type,
        priority,
        description: description.trim(),
      });
      setComposing(false);
      setType(null);
      setDescription("");
      await load();
      Alert.alert("Issue raised", "The service team can see this now.");
    } catch (error: any) {
      Alert.alert("Could not raise the issue", error?.message ?? "Try again when you have a connection.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

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
            tintColor={colors.blue}
          />
        }
      >
        <Card>
          {composing ? (
            <View style={{ gap: spacing.md }}>
              <SectionTitle title={t("issues.new")} />
              {presetRetailer ? (
                <Text style={styles.muted}>For {presetRetailerName ?? "this customer"}</Text>
              ) : (
                <Field label="Customer">
                  <OptionGrid
                    options={retailers.map((retailer: any) => ({
                      value: retailer.id,
                      label: retailer.name,
                    }))}
                    value={retailerId}
                    onChange={setRetailerId}
                  />
                </Field>
              )}
              <Field label={t("issues.type")}>
                <OptionGrid options={ISSUE_TYPES} value={type} onChange={setType} />
              </Field>
              <Field label={t("issues.priority")}>
                <OptionGrid options={PRIORITIES} value={priority} onChange={setPriority} />
              </Field>
              <Field label={t("issues.description")}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Two cases arrived crushed on the last delivery"
                  placeholderTextColor={colors.inkFaint}
                  style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
                  multiline
                />
              </Field>
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label={t("common.cancel")} onPress={() => setComposing(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={saving ? t("common.submitting") : t("issues.submit")}
                    disabled={saving}
                    onPress={() => void submit()}
                  />
                </View>
              </View>
            </View>
          ) : (
            <PrimaryButton
              label={t("issues.new")}
              icon="alert-circle-outline"
              onPress={() => setComposing(true)}
            />
          )}
        </Card>

        <Card>
          <SectionTitle title={t("issues.title")} />
          {issues.length === 0 ? (
            <Text style={styles.muted}>{t("issues.none")}</Text>
          ) : (
            issues.map((issue, index) => (
              <ListRow
                key={issue.id}
                first={index === 0}
                icon="alert-circle-outline"
                title={`${issue.retailer?.name ?? "Customer"} · ${
                  ISSUE_TYPES.find((option) => option.value === issue.type)?.label ?? issue.type
                }`}
                subtitle={[
                  issue.description,
                  issue.assignedTeam ? `Assigned to ${issue.assignedTeam}` : null,
                  issue.resolutionNote,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                right={
                  <Tag
                    label={issue.status.replace("_", " ")}
                    tone={STATUS_TONE[issue.status] ?? "neutral"}
                  />
                }
              />
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: spacing.xxl },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
  actions: { flexDirection: "row", gap: spacing.sm },
});
