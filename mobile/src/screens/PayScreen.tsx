import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { api, ApiError } from "../api/client";
import { colors, radius, spacing, inr } from "../theme";
import { ScreenSkeleton, SectionTitle } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

const BUCKETS: { key: string; label: string; danger?: boolean }[] = [
  { key: "current", label: "Not yet due" },
  { key: "days1to30", label: "1–30 days late", danger: true },
  { key: "days31to60", label: "31–60 days late", danger: true },
  { key: "days60plus", label: "Over 60 days late", danger: true },
];

export default function PayScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [dues, setDues] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const res = await api.getDues();
    setDues(res);
    // Default to clearing overdue first — that's what a retailer usually wants.
    setAmount(String(res.overdue > 0 ? res.overdue : res.outstanding));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setDues(null))
        .finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ScreenSkeleton rows={4} />
      </View>
    );
  }
  if (!dues) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("errors.generic")}</Text>
      </View>
    );
  }

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= dues.outstanding;

  const pay = async () => {
    if (!valid) return;
    setPaying(true);
    try {
      const intent = await api.createPaymentIntent(value);

      // A real provider hands off to a UPI app or hosted page here and the
      // result arrives by webhook. The mock provider gives us a signed token so
      // the same server-side verification path runs.
      const payload = intent.clientPayload as { providerRef: string; confirmToken: string };
      await api.confirmMockPayment(payload.providerRef, payload.confirmToken);

      const settled = await api.getPayment(intent.paymentId);
      if (settled.status !== "succeeded") {
        throw new ApiError(400, { error: settled.failureReason || "Payment did not go through" });
      }

      await load();
      Alert.alert(t("pay.paymentReceived"), `${inr(value)} has been credited to your account.`, [
        { text: t("pay.viewLedger"), onPress: () => navigation.navigate("Ledger") },
        { text: t("pay.done"), style: "cancel" },
      ]);
    } catch (e) {
      Alert.alert("Payment failed", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const ageing = dues.ageing ?? {};

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      <View style={styles.strip}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel} numberOfLines={1}>
            {t("pay.totalOutstanding")}
          </Text>
          <Text
            style={styles.cellValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {inr(dues.outstanding)}
          </Text>
        </View>
        {dues.overdue > 0 ? (
          <View style={[styles.cell, styles.cellBorder]}>
            <Text style={styles.cellLabel} numberOfLines={1}>
              {t("home.overdue")}
            </Text>
            <Text
              style={[styles.cellValue, styles.overdueValue]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {inr(dues.overdue)}
            </Text>
          </View>
        ) : null}
      </View>

      <SectionTitle>{t("pay.howDuesAge")}</SectionTitle>
      <View style={styles.band}>
        {BUCKETS.map((b, i) => {
          const amt = Number(ageing[b.key] ?? 0);
          if (amt <= 0) return null;
          return (
            <View key={b.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{b.label}</Text>
              <Text style={[styles.rowValue, b.danger && { color: colors.danger }]}>{inr(amt)}</Text>
            </View>
          );
        })}
        {ageing.oldestDueDate && (
          <Text style={styles.oldest}>
            Oldest unpaid bill was due{" "}
            {new Date(ageing.oldestDueDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        )}
      </View>

      <SectionTitle>{t("pay.amountToPay")}</SectionTitle>
      <View style={styles.band}>
        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.inkFaint}
          />
        </View>

        <View style={styles.quickRow}>
          {dues.overdue > 0 && (
            <TouchableOpacity style={styles.quickBtn} onPress={() => setAmount(String(dues.overdue))}>
              <Text style={styles.quickText}>{t("pay.payOverdue")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.quickBtn} onPress={() => setAmount(String(dues.outstanding))}>
            <Text style={styles.quickText}>{t("pay.payAll")}</Text>
          </TouchableOpacity>
        </View>

        {!valid && amount.length > 0 && (
          <Text style={styles.error}>
            {value > dues.outstanding
              ? `You only owe ${inr(dues.outstanding)}.`
              : "Enter an amount greater than zero."}
          </Text>
        )}
      </View>

      <Text style={styles.noteText}>
        Payments clear your oldest bill first, so paying reduces overdue before anything else.
      </Text>

      <TouchableOpacity
        style={[styles.payBtn, (!valid || paying) && styles.payBtnDisabled]}
        disabled={!valid || paying}
        onPress={pay}
      >
        {paying ? (
          <ActivityIndicator color={colors.onDark} />
        ) : (
          <>
            <MaterialCommunityIcons name="cellphone-check" size={18} color={colors.onDark} />
            <Text style={styles.payText}>Pay {valid ? inr(value) : ""} by UPI</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.devHint}>
        Development mode — payments are simulated and no money moves.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg },
  muted: { color: colors.inkMuted },

  strip: {
    flexDirection: "row",
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  cell: { flex: 1, paddingRight: spacing.sm },
  cellBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  cellLabel: { fontSize: 10.5, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.2 },
  cellValue: { fontSize: 22, fontWeight: "700", color: colors.ink, marginTop: 4 },
  overdueValue: { color: colors.error },

  band: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowLabel: { fontSize: 13.5, color: colors.inkMuted },
  rowValue: { fontSize: 14, fontWeight: "700", color: colors.ink },
  oldest: { fontSize: 11.5, color: colors.inkMuted, marginTop: spacing.sm },

  amountRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rupee: { fontSize: 26, fontWeight: "700", color: colors.ink },
  amountInput: { flex: 1, fontSize: 30, fontWeight: "700", color: colors.ink, paddingVertical: 6 },
  quickRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  quickBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: "center",
  },
  quickText: { color: colors.green, fontWeight: "700", fontSize: 12.5 },
  error: { color: colors.danger, fontSize: 12, marginTop: spacing.sm, fontWeight: "600" },

  noteText: { fontSize: 13, color: colors.inkMuted, lineHeight: 18, marginTop: spacing.lg },

  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.md,
    paddingVertical: 16,
    minHeight: 48,
    marginTop: spacing.xl,
  },
  payBtnDisabled: { opacity: 0.4 },
  payText: { color: colors.onDark, fontWeight: "700", fontSize: 15.5 },
  devHint: {
    textAlign: "center",
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: spacing.md,
  },
});
