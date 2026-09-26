import React, { useCallback, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import type { PaymentInvoiceOption } from "../types";
import { toPaymentProof, type PaymentProofImage } from "./paymentEvidence";
import EntityAttribution from "../components/finance/EntityAttribution";
import { entityAttributionPresentation } from "../lib/homePresentation";
import { useAuth } from "../context/AuthContext";
import { createPaymentAttemptStorage } from "../context/paymentAttemptStorage";

const paymentAttemptStorage = createPaymentAttemptStorage(AsyncStorage);

const BUCKETS: { key: string; label: string; danger?: boolean }[] = [
  { key: "current", label: "Not yet due" },
  { key: "days1to30", label: "1–30 days late", danger: true },
  { key: "days31to60", label: "31–60 days late", danger: true },
  { key: "days60plus", label: "Over 60 days late", danger: true },
];

function parseMoneyInput(input: string): number | null {
  const value = input.trim();
  if (!value) return 0;
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && Math.abs(amount * 100 - cents) < 0.0001 ? cents / 100 : null;
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

export default function PayScreen({ navigation }: any) {
  const { t } = useLanguage();
  const { retailer } = useAuth();
  const payingRef = useRef(false);
  const [dues, setDues] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentHistoryUnavailable, setPaymentHistoryUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [jainAmount, setJainAmount] = useState("");
  const [padamAmount, setPadamAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [selectedProof, setSelectedProof] = useState<(PaymentProofImage & { paymentId: string }) | null>(null);
  const [uploadingProofFor, setUploadingProofFor] = useState<string | null>(null);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [duesResult, historyResult] = await Promise.allSettled([api.getDues(), api.getPayments()]);
    if (duesResult.status === "rejected") throw duesResult.reason;
    setDues(duesResult.value);
    const paymentInvoices: PaymentInvoiceOption[] = duesResult.value.paymentInvoices ?? [];
    if (duesResult.value.invoiceAllocationRequired) {
      setAmount("");
      setSelectedInvoiceId((current) =>
        paymentInvoices.some((invoice) => invoice.id === current && invoice.paymentEligible) ? current : null
      );
      setJainAmount("");
      setPadamAmount("");
    } else {
      setSelectedInvoiceId(null);
      setJainAmount("");
      setPadamAmount("");
      // Default to clearing overdue first — that's what a retailer usually wants.
      const defaultAmount = duesResult.value.overdue > 0 ? duesResult.value.overdue : duesResult.value.outstanding;
      setAmount(defaultAmount > 0 ? String(defaultAmount) : "");
    }
    setPayments(historyResult.status === "fulfilled" ? historyResult.value.payments ?? [] : []);
    setPaymentHistoryUnavailable(historyResult.status === "rejected");
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

  const paymentInvoices: PaymentInvoiceOption[] = dues.paymentInvoices ?? [];
  const reconciliationRequired = Boolean(dues.financialSummary?.reconciliationRequired);
  const invoiceAllocationRequired = Boolean(dues.invoiceAllocationRequired);
  const selectedInvoice = paymentInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const jainValue = parseMoneyInput(jainAmount);
  const padamValue = parseMoneyInput(padamAmount);
  const genericValue = parseMoneyInput(amount);
  const value = selectedInvoice && jainValue !== null && padamValue !== null
    ? (cents(jainValue) + cents(padamValue)) / 100
    : genericValue ?? 0;
  const scopedValid = Boolean(
    selectedInvoice?.paymentEligible &&
    jainValue !== null && padamValue !== null &&
    (jainValue > 0 || padamValue > 0) &&
    cents(jainValue) <= cents(selectedInvoice.entityBalances.jainTraders) &&
    cents(padamValue) <= cents(selectedInvoice.entityBalances.padamInternational) &&
    cents(value) <= cents(selectedInvoice.outstanding)
  );
  const genericValid = genericValue !== null && genericValue > 0 && genericValue <= Number(dues.outstanding);
  const valid = !reconciliationRequired && (invoiceAllocationRequired ? scopedValid : genericValid);
  const paymentValue = invoiceAllocationRequired ? value : genericValue ?? 0;
  const eligibleInvoiceTotal = paymentInvoices
    .filter((invoice) => invoice.paymentEligible)
    .reduce((total, invoice) => total + invoice.outstanding, 0);
  const unavailableOutstanding = Math.max(0, Number(dues.outstanding) - eligibleInvoiceTotal);

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
    if (!valid || payingRef.current || !retailer?.id) return;
    payingRef.current = true;
    setPaying(true);
    try {
      const attemptKey = await paymentAttemptStorage.getOrCreate(retailer.id, {
        amountCents: cents(paymentValue),
        invoiceScopeId: selectedInvoice?.id ?? null,
        jainCents: selectedInvoice ? cents(jainValue ?? 0) : null,
        padamCents: selectedInvoice ? cents(padamValue ?? 0) : null,
      });
      let intent;
      try {
        intent = await api.createPaymentIntent(paymentValue, attemptKey, selectedInvoice ? {
        invoiceScopeId: selectedInvoice.id,
        jainAmount: jainValue ?? 0,
        padamAmount: padamValue ?? 0,
        } : undefined);
      } catch (error) {
        if (error instanceof ApiError && [400, 404, 409].includes(error.status)) {
          await paymentAttemptStorage.clear(retailer.id);
        }
        throw error;
      }

      // A real provider hands off to a UPI app or hosted page here and the
      // result arrives by webhook. The mock provider gives us a signed token so
      // the same server-side verification path runs.
      const payload = intent.clientPayload as { providerRef: string; confirmToken: string };
      await api.confirmMockPayment(payload.providerRef, payload.confirmToken);

      const settled = await api.getPayment(intent.paymentId);
      if (settled.status !== "succeeded") {
        if (settled.status === "failed" || settled.status === "cancelled") {
          await paymentAttemptStorage.clear(retailer.id);
        }
        throw new ApiError(400, { error: settled.failureReason || "Payment did not go through" });
      }

      await paymentAttemptStorage.clear(retailer.id);
      setJainAmount("");
      setPadamAmount("");
      await load();
      Alert.alert(t("pay.paymentReceived"), `${inr(paymentValue)} has been credited to your account.`, [
        { text: t("pay.viewLedger"), onPress: () => navigation.navigate("Ledger") },
        { text: t("pay.done"), style: "cancel" },
      ]);
    } catch (e) {
      Alert.alert("Payment failed", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      payingRef.current = false;
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
            {reconciliationRequired ? "—" : inr(dues.outstanding)}
          </Text>
        </View>
        {!reconciliationRequired && dues.overdue > 0 ? (
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

      {reconciliationRequired ? (
        <Text style={styles.warningText}>{t("finance.balanceUnderReviewBody")}</Text>
      ) : null}

      {!reconciliationRequired && (
        <>
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
        </>
      )}

      {!reconciliationRequired && (invoiceAllocationRequired ? (
        <>
          <SectionTitle>{t("pay.selectInvoice")}</SectionTitle>
          <View style={styles.invoiceList}>
            {paymentInvoices.map((invoice) => {
              const selected = selectedInvoiceId === invoice.id;
              const presentation = entityAttributionPresentation(
                invoice.entityBalances,
                invoice.attributionStatus,
                invoice.outstanding
              );
              return (
                <TouchableOpacity
                  key={invoice.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: !invoice.paymentEligible }}
                  disabled={!invoice.paymentEligible}
                  onPress={() => {
                    setSelectedInvoiceId(invoice.id);
                    setJainAmount("");
                    setPadamAmount("");
                  }}
                  style={[styles.invoiceRow, selected && styles.invoiceRowSelected, !invoice.paymentEligible && styles.invoiceRowUnavailable]}
                >
                  <MaterialCommunityIcons
                    name={!invoice.paymentEligible ? "alert-circle-outline" : selected ? "radiobox-marked" : "radiobox-blank"}
                    size={20}
                    color={!invoice.paymentEligible ? colors.inkFaint : selected ? colors.green : colors.inkMuted}
                  />
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceNumber} numberOfLines={1}>
                      {t("pay.invoiceRef", { number: invoice.invoiceNumber })}
                    </Text>
                    {invoice.orderNo != null ? (
                      <Text style={styles.invoiceMeta}>{t("pay.orderRef", { order: invoice.orderNo })}</Text>
                    ) : null}
                    <Text style={styles.invoiceMeta}>
                      {t("pay.dueDate", { date: new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) })}
                    </Text>
                    <EntityAttribution rows={presentation.rows} status={presentation.status} variant="inline" />
                    {!invoice.paymentEligible ? <Text style={styles.invoiceUnavailable}>{t("pay.invoiceNotPayable")}</Text> : null}
                  </View>
                  <Text style={styles.invoiceOutstanding} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {inr(invoice.outstanding)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {paymentInvoices.length === 0 ? <Text style={styles.muted}>{t("pay.invoiceReviewRequired")}</Text> : null}
          </View>
          {unavailableOutstanding > 0.009 ? (
            <Text style={styles.warningText}>{t("pay.otherBalancesUnavailable")}</Text>
          ) : null}

          <SectionTitle>{t("pay.amountToPay")}</SectionTitle>
          <View style={styles.band}>
            {selectedInvoice ? (
              <>
                <Text style={styles.noteText}>{t("pay.invoiceAllocationNote")}</Text>
                <View style={styles.entityInputRow}>
                  <View style={styles.entityInputLabel}>
                    <Text style={styles.rowLabel}>{t("pay.amountForEntity", { entity: t("finance.jainTraders") })}</Text>
                    <Text style={styles.rowValue}>{inr(selectedInvoice.entityBalances.jainTraders)}</Text>
                  </View>
                  <TextInput
                    accessibilityLabel={t("pay.amountForEntity", { entity: t("finance.jainTraders") })}
                    style={styles.entityAmountInput}
                    value={jainAmount}
                    onChangeText={setJainAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.inkFaint}
                  />
                </View>
                <View style={[styles.entityInputRow, styles.rowBorder]}>
                  <View style={styles.entityInputLabel}>
                    <Text style={styles.rowLabel}>{t("pay.amountForEntity", { entity: t("finance.padamInternational") })}</Text>
                    <Text style={styles.rowValue}>{inr(selectedInvoice.entityBalances.padamInternational)}</Text>
                  </View>
                  <TextInput
                    accessibilityLabel={t("pay.amountForEntity", { entity: t("finance.padamInternational") })}
                    style={styles.entityAmountInput}
                    value={padamAmount}
                    onChangeText={setPadamAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.inkFaint}
                  />
                </View>
                <View style={[styles.row, styles.totalRow]}>
                  <Text style={styles.rowLabel}>{t("pay.allocationTotal")}</Text>
                  <Text style={styles.rowValue}>{inr(value)}</Text>
                </View>
                {!scopedValid && (jainAmount.length > 0 || padamAmount.length > 0) ? (
                  <Text style={styles.error}>{t("pay.allocationInvalid")}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.muted}>{t("pay.selectInvoiceHint")}</Text>
            )}
          </View>
        </>
      ) : (
        <>
          <SectionTitle>{t("pay.amountToPay")}</SectionTitle>
          <View style={styles.band}>
            <View style={styles.amountRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
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
              {dues.outstanding > 0 && (
                <TouchableOpacity style={styles.quickBtn} onPress={() => setAmount(String(dues.outstanding))}>
                  <Text style={styles.quickText}>{t("pay.payAll")}</Text>
                </TouchableOpacity>
              )}
            </View>

            {!valid && amount.length > 0 ? (
              <Text style={styles.error}>
                {genericValue !== null && genericValue > Number(dues.outstanding)
                  ? t("pay.amountTooHigh", { amount: inr(Number(dues.outstanding)) })
                  : t("pay.amountInvalid")}
              </Text>
            ) : null}
          </View>
          <Text style={styles.noteText}>
            Payments clear your oldest bill first, so paying reduces overdue before anything else.
          </Text>
        </>
      ))}

      {!reconciliationRequired && (
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
              <Text style={styles.payText}>Pay {valid ? inr(paymentValue) : ""} by UPI</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {!reconciliationRequired && (
        <Text style={styles.devHint}>Development mode — payments are simulated and no money moves.</Text>
      )}

      <SectionTitle>{t("pay.recentPayments")}</SectionTitle>
      <View style={styles.history}>
        {paymentHistoryUnavailable ? <Text style={styles.muted}>{t("pay.historyUnavailable")}</Text> : null}
        {!paymentHistoryUnavailable && payments.length === 0 ? <Text style={styles.muted}>{t("pay.noPayments")}</Text> : null}
        {payments.map((payment) => {
          const evidence = payment.evidence ?? [];
          const allocations = payment.allocations?.length
            ? payment.allocations
            : payment.invoice
              ? [{
                  invoice: payment.invoice,
                  amount: Number(payment.amount),
                  jainAmount: payment.jainAmount,
                  padamAmount: payment.padamAmount,
                }]
              : [];
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
              {allocations.map((allocation: any, index: number) => (
                <View key={`${allocation.invoice.id}-${index}`} style={styles.paymentAllocation}>
                  <Text style={styles.historyMeta}>
                    {t("pay.invoiceRef", { number: allocation.invoice.invoiceNumber })}
                    {allocation.invoice.orderNo != null ? ` · ${t("pay.orderRef", { order: allocation.invoice.orderNo })}` : ""}
                  </Text>
                  <View style={styles.allocationHistorySplit}>
                    {allocation.jainAmount != null ? (
                      <Text style={styles.historyMeta}>{t("finance.jainTraders")} {inr(Number(allocation.jainAmount))}</Text>
                    ) : null}
                    {allocation.padamAmount != null ? (
                      <Text style={styles.historyMeta}>{t("finance.padamInternational")} {inr(Number(allocation.padamAmount))}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
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

  invoiceList: { gap: spacing.sm, marginBottom: spacing.md },
  invoiceRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  invoiceRowSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  invoiceRowUnavailable: { opacity: 0.62 },
  invoiceInfo: { flex: 1, minWidth: 0, gap: 2 },
  invoiceNumber: { fontSize: 13, fontWeight: "700", color: colors.ink },
  invoiceMeta: { fontSize: 11, color: colors.inkMuted },
  invoiceOutstanding: { minWidth: 68, textAlign: "right", fontSize: 13, fontWeight: "700", color: colors.ink },
  invoiceUnavailable: { fontSize: 10.5, fontWeight: "600", color: colors.danger, marginTop: 3 },
  warningText: { color: colors.warning, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },

  amountRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rupee: { fontSize: 26, fontWeight: "700", color: colors.ink },
  amountInput: { flex: 1, fontSize: 30, fontWeight: "700", color: colors.ink, paddingVertical: 6 },
  entityInputRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  entityInputLabel: { flex: 1, minWidth: 0, gap: 3 },
  entityAmountInput: { width: 112, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, textAlign: "right", fontSize: 16, fontWeight: "700", color: colors.ink },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.md },
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
  paymentAllocation: { gap: 2, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.greenSoft },
  allocationHistorySplit: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md, rowGap: 2 },
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
