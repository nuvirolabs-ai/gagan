import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { api, ApiError } from "../api/client";
import { colors, radius, spacing, inr } from "../theme";
import { ScreenSkeleton, SectionTitle } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { toPaymentProof, type PaymentProofImage } from "./paymentEvidence";

const BUCKETS: { key: string; label: string; danger?: boolean }[] = [
  { key: "current", label: "Not yet due" },
  { key: "days1to30", label: "1–30 days late", danger: true },
  { key: "days31to60", label: "31–60 days late", danger: true },
  { key: "days60plus", label: "Over 60 days late", danger: true },
];

export default function PayScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [dues, setDues] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentHistoryUnavailable, setPaymentHistoryUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [selectedProof, setSelectedProof] = useState<(PaymentProofImage & { paymentId: string }) | null>(null);
  const [uploadingProofFor, setUploadingProofFor] = useState<string | null>(null);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [duesResult, historyResult] = await Promise.allSettled([api.getDues(), api.getPayments()]);
    if (duesResult.status === "rejected") throw duesResult.reason;
    setDues(duesResult.value);
    setPayments(historyResult.status === "fulfilled" ? historyResult.value.payments ?? [] : []);
    setPaymentHistoryUnavailable(historyResult.status === "rejected");
    // Default to clearing overdue first — that's what a retailer usually wants.
    setAmount(String(duesResult.value.overdue > 0 ? duesResult.value.overdue : duesResult.value.outstanding));
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

  const selectProof = async (paymentId: string, source: "camera" | "library") => {
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t("pay.cameraPermissionTitle"), t("pay.cameraPermissionBody"));
          return;
        }
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 });
      if (result.canceled) return;
      setSelectedProof({ paymentId, ...toPaymentProof(result.assets[0]) });
    } catch (error) {
      const key = error instanceof Error && error.message === "proof_too_large"
        ? "pay.proofTooLarge"
        : "pay.proofSelectionFailed";
      Alert.alert(t("pay.attachProof"), t(key));
    }
  };

  const uploadProof = async (paymentId: string) => {
    if (!selectedProof || selectedProof.paymentId !== paymentId || uploadingProofFor) return;
    setUploadingProofFor(paymentId);
    try {
      await api.attachPaymentEvidence(paymentId, {
        contentType: selectedProof.contentType,
        bodyBase64: selectedProof.bodyBase64,
      });
      setSelectedProof(null);
      await load();
      Alert.alert(t("pay.proofUploaded"));
    } catch (error) {
      Alert.alert(t("pay.attachProof"), error instanceof ApiError ? error.message : t("pay.proofUploadFailed"));
    } finally {
      setUploadingProofFor(null);
    }
  };

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

      <SectionTitle>{t("pay.recentPayments")}</SectionTitle>
      <View style={styles.history}>
        {paymentHistoryUnavailable ? <Text style={styles.muted}>{t("pay.historyUnavailable")}</Text> : null}
        {!paymentHistoryUnavailable && payments.length === 0 ? <Text style={styles.muted}>{t("pay.noPayments")}</Text> : null}
        {payments.map((payment) => {
          const evidence = payment.evidence ?? [];
          const selectedPaymentProof = selectedProof?.paymentId === payment.id ? selectedProof : null;
          return (
            <View key={payment.id} style={styles.historyRow}>
              <View style={styles.historyHeader}>
                <View style={styles.historyIdentity}>
                  <Text style={styles.historyAmount}>{inr(Number(payment.amount))}</Text>
                  <Text style={styles.historyMeta}>
                    {new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {` · ${String(payment.status).replaceAll("_", " ")}`}
                  </Text>
                </View>
                {evidence.length > 0 ? <Text style={styles.proofAttached}>{t("pay.proofAttached")}</Text> : null}
              </View>
              {evidence.map((item: { id: string; signedUrl: string | null; contentType: string }) => (
                <View key={item.id} style={styles.evidenceRow}>
                  {item.signedUrl ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t("pay.viewProof")}
                      onPress={() => setExpandedEvidenceId(expandedEvidenceId === item.id ? null : item.id)}
                    >
                      <Image
                        source={{ uri: item.signedUrl }}
                        accessibilityLabel={t("pay.viewProof")}
                        resizeMode="contain"
                        style={expandedEvidenceId === item.id ? styles.proofExpanded : styles.proofThumbnail}
                      />
                      <Text style={styles.proofLink}>{t("pay.viewProof")}</Text>
                    </TouchableOpacity>
                  ) : <Text style={styles.historyMeta}>{t("pay.proofUnavailable")}</Text>}
                </View>
              ))}
              {selectedPaymentProof ? (
                <View style={styles.proofSelection}>
                  <Image source={{ uri: selectedPaymentProof.uri }} resizeMode="cover" style={styles.proofPreview} />
                  <View style={styles.selectionDetails}>
                    <Text numberOfLines={2} style={styles.historyMeta}>{selectedPaymentProof.name}</Text>
                    <View style={styles.proofActions}>
                      <TouchableOpacity disabled={uploadingProofFor !== null} onPress={() => setSelectedProof(null)} style={styles.proofAction}>
                        <MaterialCommunityIcons name="close" size={16} color={colors.inkMuted} />
                        <Text style={styles.proofActionText}>{t("pay.removeProof")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity disabled={uploadingProofFor !== null} onPress={() => void uploadProof(payment.id)} style={styles.proofUpload}>
                        {uploadingProofFor === payment.id ? <ActivityIndicator color={colors.onDark} /> : <Text style={styles.proofUploadText}>{t("pay.uploadProof")}</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.proofActions}>
                  <TouchableOpacity accessibilityRole="button" disabled={uploadingProofFor !== null} onPress={() => void selectProof(payment.id, "camera")} style={styles.proofAction}>
                    <MaterialCommunityIcons name="camera-outline" size={16} color={colors.green} />
                    <Text style={styles.proofActionText}>{t("pay.takePhoto")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" disabled={uploadingProofFor !== null} onPress={() => void selectProof(payment.id, "library")} style={styles.proofAction}>
                    <MaterialCommunityIcons name="image-outline" size={16} color={colors.green} />
                    <Text style={styles.proofActionText}>{t("pay.chooseImage")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
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
  history: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  historyRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.md, gap: spacing.sm },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  historyIdentity: { flex: 1, gap: 2 },
  historyAmount: { fontSize: 15, fontWeight: "700", color: colors.ink },
  historyMeta: { color: colors.inkMuted, fontSize: 12 },
  proofAttached: { color: colors.green, fontSize: 11, fontWeight: "700" },
  evidenceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  proofThumbnail: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  proofExpanded: { width: 240, height: 280, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  proofLink: { color: colors.green, fontSize: 11, fontWeight: "700", marginTop: 3 },
  proofSelection: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  proofPreview: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  selectionDetails: { flex: 1, gap: spacing.sm },
  proofActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  proofAction: { minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  proofActionText: { color: colors.green, fontSize: 11, fontWeight: "700" },
  proofUpload: { minHeight: 38, backgroundColor: colors.green, borderRadius: radius.sm, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  proofUploadText: { color: colors.onDark, fontSize: 11, fontWeight: "700" },
});
