import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ScreenHeader } from "../components/ui";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { repApi } from "../api/repClient";
import { colors, radius, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

type CollectionRetailer = { id: string; name: string; phone: string; shopAddress: string };
type CollectionSubmission = { id: string; amount: number | string; method: string; status: string; retailer: { id: string; name: string; phone: string } };
const methods = ["cash", "cheque", "neft", "upi"] as const;

export default function StaffHomeScreen() {
  const { staff } = useRep();
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const canConfirmCollections = staff?.permissions.includes("collection.confirm") ?? false;
  const [retailers, setRetailers] = useState<CollectionRetailer[]>([]);
  const [submissions, setSubmissions] = useState<CollectionSubmission[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]>("cash");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; contentType: string; bodyBase64: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepUpChallenge, setStepUpChallenge] = useState<string | null>(null);
  const [stepUpOtp, setStepUpOtp] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assigned, queue] = await Promise.all([
        capabilities.canCollect ? repApi.collectionRetailers() : Promise.resolve({ retailers: [] }),
        canConfirmCollections ? repApi.collectionSubmissions() : Promise.resolve({ submissions: [] }),
      ]);
      setRetailers(assigned.retailers.map((a: any) => a.retailer));
      setSubmissions(queue.submissions);
    } catch (error) {
      Alert.alert("Could not load collections", error instanceof Error ? error.message : "Try again.");
    } finally {
      setLoading(false);
    }
  }, [canConfirmCollections, capabilities.canCollect]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const parsedAmount = Number(amount);
    if (!selectedRetailerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Add collection details", "Choose a retailer and enter a valid amount.");
      return;
    }
    if (reference.trim().length < 3 && !receipt) {
      Alert.alert("Reference required", "Add a receipt, cheque, bank, or UPI reference before submitting.");
      return;
    }
    setSaving(true);
    try {
      await repApi.submitCollection({ retailerId: selectedRetailerId, amount: parsedAmount, method, reference: reference.trim() || undefined, evidence: receipt ? { contentType: receipt.contentType, bodyBase64: receipt.bodyBase64 } : undefined, idempotencyKey: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}` });
      setAmount(""); setReference(""); setReceipt(null);
      Alert.alert("Submitted", "Accounts will verify this collection before it affects the ledger.");
      await load();
    } catch (error) {
      Alert.alert("Could not submit", error instanceof Error ? error.message : "Try again.");
    } finally { setSaving(false); }
  };

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const bodyBase64 = await new File(asset.uri).base64();
      setReceipt({ name: asset.name, contentType: asset.mimeType ?? "application/pdf", bodyBase64 });
    } catch (error) {
      Alert.alert("Could not attach receipt", error instanceof Error ? error.message : "Try again.");
    }
  };

  const startConfirm = async () => {
    try {
      const result = await repApi.requestStepUp();
      setStepUpChallenge(result.challengeId);
      Alert.alert("Verification sent", "Enter the one-time code sent to your registered phone.");
    } catch (error) { Alert.alert("Could not start verification", error instanceof Error ? error.message : "Try again."); }
  };

  const confirm = async (id: string) => {
    if (!stepUpChallenge || stepUpOtp.trim().length < 4) { Alert.alert("Verification needed", "Request verification and enter the code first."); return; }
    try {
      await repApi.completeStepUp(stepUpChallenge, stepUpOtp.trim());
      await repApi.confirmCollection(id);
      setStepUpChallenge(null); setStepUpOtp(""); await load();
    } catch (error) { Alert.alert("Could not confirm", error instanceof Error ? error.message : "Try again."); }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.green} /></View>;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("tabs.work")} subtitle={`Hi ${staff?.name ?? ""}`} />
      <ScrollView contentContainerStyle={styles.content}>
        {capabilities.canCollect ? <View style={styles.card}>
          <View style={styles.cardTitleRow}><View style={styles.icon}><Ionicons name="cash-outline" size={22} color={colors.green} /></View><View><Text style={styles.title}>{t("work.submitCollection")}</Text><Text style={styles.muted}>{t("work.accountsVerify")}</Text></View></View>
          <Text style={styles.label}>Retailer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{retailers.map((retailer) => <TouchableOpacity key={retailer.id} onPress={() => setSelectedRetailerId(retailer.id)} style={[styles.chip, selectedRetailerId === retailer.id && styles.chipActive]}><Text style={[styles.chipText, selectedRetailerId === retailer.id && styles.chipTextActive]}>{retailer.name}</Text></TouchableOpacity>)}</ScrollView>
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.inkFaint} style={styles.input} />
          <Text style={styles.label}>Method</Text>
          <View style={styles.methodRow}>{methods.map((value) => <TouchableOpacity key={value} onPress={() => setMethod(value)} style={[styles.method, method === value && styles.methodActive]}><Text style={[styles.methodText, method === value && styles.methodTextActive]}>{value.toUpperCase()}</Text></TouchableOpacity>)}</View>
          <TextInput value={reference} onChangeText={setReference} placeholder="Receipt / cheque / bank reference" placeholderTextColor={colors.inkFaint} style={styles.input} />
          <TouchableOpacity disabled={saving} onPress={() => void pickReceipt()} style={styles.attachment}><Ionicons name="attach-outline" size={17} color={colors.green} /><Text style={styles.attachmentText}>{receipt ? `Attached: ${receipt.name}` : "Attach receipt photo or PDF (optional)"}</Text></TouchableOpacity>
          <TouchableOpacity disabled={saving} onPress={submit} style={styles.primary}><Text style={styles.primaryText}>{saving ? t("collections.submitting") : t("collections.submit")}</Text></TouchableOpacity>
        </View> : null}

        {canConfirmCollections ? <View style={styles.card}>
          <View style={styles.cardTitleRow}><View style={styles.icon}><Ionicons name="checkmark-done-outline" size={22} color={colors.green} /></View><View><Text style={styles.title}>{t("collections.accountsQueue")}</Text><Text style={styles.muted}>{submissions.length} pending verification{stepUpChallenge ? " · verification active" : ""}</Text></View></View>
          {submissions.map((submission) => <View key={submission.id} style={styles.queueRow}><View style={{ flex: 1 }}><Text style={styles.queueTitle}>{submission.retailer.name}</Text><Text style={styles.muted}>₹{Number(submission.amount).toLocaleString("en-IN")} · {submission.method}</Text></View><TouchableOpacity onPress={stepUpChallenge ? () => void confirm(submission.id) : () => void startConfirm()} style={styles.smallButton}><Text style={styles.smallButtonText}>{stepUpChallenge ? "Confirm" : "Verify"}</Text></TouchableOpacity></View>)}
          {stepUpChallenge ? <TextInput value={stepUpOtp} onChangeText={setStepUpOtp} keyboardType="number-pad" placeholder="Enter OTP" placeholderTextColor={colors.inkFaint} style={styles.input} /> : null}
          {submissions.length === 0 ? <Text style={styles.muted}>{t("work.noCollections")}</Text> : null}
        </View> : null}

        {!capabilities.canCollect && !canConfirmCollections ? <View style={styles.card}><Text style={styles.title}>Your staff access is active</Text><Text style={styles.muted}>No operational workspace has been assigned yet. Ask your administrator if you need another role.</Text></View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12.5, lineHeight: 18, color: colors.inkMuted },
  label: { fontSize: 12, fontWeight: "700", color: colors.inkMuted, marginTop: spacing.sm },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  chipText: { color: colors.inkMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.green },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.ink, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  method: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.sm },
  methodActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  methodText: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  methodTextActive: { color: colors.green },
  primary: { backgroundColor: colors.green, borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  primaryText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },
  attachment: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  attachmentText: { color: colors.green, fontSize: 12.5, fontWeight: "700", flex: 1 },
  queueRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  queueTitle: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  smallButton: { backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  smallButtonText: { color: colors.green, fontWeight: "700", fontSize: 12 },
});
