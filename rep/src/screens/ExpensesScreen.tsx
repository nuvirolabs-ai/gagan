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
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

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
import { colors, inr, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "fuel", label: "Fuel" },
  { value: "food", label: "Food" },
  { value: "lodging", label: "Lodging" },
  { value: "telephone", label: "Phone" },
  { value: "other", label: "Other" },
];

const STATUS_TONE: Record<string, "green" | "gold" | "danger"> = {
  approved: "green",
  submitted: "gold",
  rejected: "danger",
};

/**
 * The salesperson's slice of expenses: claim it, attach the receipt, see the
 * decision. Approval happens in the back office, never here.
 */
export default function ExpensesScreen() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("travel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; contentType: string; bodyBase64: string } | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const response = await repApi.expenses();
      setExpenses(response.expenses ?? []);
    } catch {
      setExpenses([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const attach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setReceipt({
        name: asset.name,
        contentType: asset.mimeType ?? "image/jpeg",
        bodyBase64: await new File(asset.uri).base64(),
      });
    } catch {
      Alert.alert("Could not attach the receipt", "Try picking the file again.");
    }
  };

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return Alert.alert("Check the amount", "Enter the amount you actually spent.");
    }
    if (description.trim().length < 3) {
      return Alert.alert("Add a description", "Say what the expense was for.");
    }
    setSaving(true);
    try {
      await repApi.submitExpense({
        expenseDate: new Date().toISOString(),
        category,
        amount: value,
        description: description.trim(),
        receipt: receipt
          ? { contentType: receipt.contentType, bodyBase64: receipt.bodyBase64 }
          : undefined,
      });
      setComposing(false);
      setAmount("");
      setDescription("");
      setReceipt(null);
      await load();
      Alert.alert("Claim submitted", "Your manager will review this in the back office.");
    } catch (error: any) {
      Alert.alert("Could not submit", error?.message ?? "Try again when you have a connection.");
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
              <SectionTitle title={t("expenses.new")} />
              <Field label={t("expenses.category")}>
                <OptionGrid options={CATEGORIES} value={category} onChange={setCategory} />
              </Field>
              <Field label={t("expenses.amount")}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.inkFaint}
                  style={inputStyle}
                />
              </Field>
              <Field label={t("expenses.description")}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Auto to Pimpri market and back"
                  placeholderTextColor={colors.inkFaint}
                  style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
                  multiline
                />
              </Field>
              <SecondaryButton
                label={receipt ? `Attached: ${receipt.name}` : t("expenses.attach")}
                icon="attach-outline"
                onPress={() => void attach()}
              />
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label={t("common.cancel")} onPress={() => setComposing(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={saving ? t("common.submitting") : t("expenses.submit")}
                    disabled={saving}
                    onPress={() => void submit()}
                  />
                </View>
              </View>
            </View>
          ) : (
            <PrimaryButton
              label={t("expenses.new")}
              icon="add-circle-outline"
              onPress={() => setComposing(true)}
            />
          )}
        </Card>

        <Card>
          <SectionTitle title={t("expenses.title")} />
          {expenses.length === 0 ? (
            <Text style={styles.muted}>{t("expenses.none")}</Text>
          ) : (
            expenses.map((expense, index) => (
              <ListRow
                key={expense.id}
                first={index === 0}
                icon="wallet-outline"
                title={`${inr(expense.amount)} · ${expense.category}`}
                subtitle={[
                  expense.description,
                  new Date(expense.expenseDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  }),
                  expense.hasReceipt ? "Receipt attached" : null,
                  expense.decisionNote,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                right={<Tag label={expense.status} tone={STATUS_TONE[expense.status] ?? "neutral"} />}
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
