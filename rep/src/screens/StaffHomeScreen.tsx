import React, { useCallback, useEffect, useState, useRef } from "react";
import { useRoute } from "@react-navigation/native";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { KeyboardSafeScrollView, ScreenHeader } from "../components/ui";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { repApi } from "../api/repClient";
import { colors, radius, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import { useLanguage } from "../i18n/LanguageContext";
import { toCollectionReceipt } from "./collectionEvidence";
import { filterCollectionRetailers, type CollectionRetailer } from "./collectionRetailerSearch";

type CollectionSubmission = { id: string; amount: number | string; method: string; status: string; retailer: { id: string; name: string; phone: string } };
const methods = ["cash", "cheque", "neft", "upi"] as const;

export default function StaffHomeScreen() {
  const { staff } = useRep();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const presetRetailerId = typeof route.params?.retailerId === "string" ? route.params.retailerId : "";
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const canConfirmCollections = staff?.permissions.includes("collection.confirm") ?? false;
  const [retailers, setRetailers] = useState<CollectionRetailer[]>([]);
  const [submissions, setSubmissions] = useState<CollectionSubmission[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [retailerQuery, setRetailerQuery] = useState("");
  const [retailerPickerOpen, setRetailerPickerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [invoices,setInvoices]=useState<any[]>([]);
  const [invoiceId,setInvoiceId]=useState("");
  const [jain,setJain]=useState("");const [padam,setPadam]=useState("");
  const [allocationConfirmed,setAllocationConfirmed]=useState(false);
  const [invoicesReady,setInvoicesReady]=useState(false);
  const collectionKey=useRef<string|null>(null);const submitting=useRef(false);
  useEffect(()=>{let active=true;setInvoices([]);setInvoiceId("");setJain("");setPadam("");setNotes("");setAllocationConfirmed(false);setInvoicesReady(false);
    if(selectedRetailerId)repApi.collectionInvoices(selectedRetailerId).then(r=>{if(active){setInvoices(r.invoices);setInvoicesReady(true);}}).catch(()=>{if(active)Alert.alert("Could not load invoice balances","Re-select the retailer to retry.");});
    return ()=>{active=false;};
  },[selectedRetailerId]);
  const [method, setMethod] = useState<(typeof methods)[number]>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<{ name: string; uri: string; contentType: string; bodyBase64: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepUpChallenge, setStepUpChallenge] = useState<string | null>(null);
  const [stepUpOtp, setStepUpOtp] = useState("");
  const referencePlaceholder = {
    cash: t("work.collectionReferenceCash"),
    cheque: t("work.collectionReferenceCheque"),
    neft: t("work.collectionReferenceNeft"),
    upi: t("work.collectionReferenceUpi"),
  }[method];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assigned, queue] = await Promise.all([
        capabilities.canCollect ? repApi.collectionRetailers() : Promise.resolve({ retailers: [] }),
        canConfirmCollections ? repApi.collectionSubmissions() : Promise.resolve({ submissions: [] }),
      ]);
      const assignedRetailers = assigned.retailers.map((a: any) => a.retailer) as CollectionRetailer[];
      setRetailers(assignedRetailers);
      setSubmissions(queue.submissions);
      setSelectedRetailerId((current) => {
        if (current && assignedRetailers.some((retailer) => retailer.id === current)) return current;
        return assignedRetailers.some((retailer) => retailer.id === presetRetailerId) ? presetRetailerId : "";
      });
    } catch (error) {
      Alert.alert("Could not load collections", error instanceof Error ? error.message : "Try again.");
    } finally {
      setLoading(false);
    }
  }, [canConfirmCollections, capabilities.canCollect, presetRetailerId]);

  useEffect(() => { void load(); }, [load]);

  const selectedRetailer = retailers.find((retailer) => retailer.id === selectedRetailerId);
  const visibleRetailers = filterCollectionRetailers(retailers, retailerQuery);
  const chooseRetailer = (retailer: CollectionRetailer) => {
    if (saving) return;
    if (retailer.id !== selectedRetailerId) collectionKey.current = null;
    setSelectedRetailerId(retailer.id);
    setRetailerQuery("");
    setRetailerPickerOpen(false);
  };

  const submit = async () => {
    if(submitting.current || !invoicesReady)return;
    if(invoices.length && (!invoiceId || !allocationConfirmed)){Alert.alert("Confirm invoice allocation","Select the invoice and explicitly confirm its Jain and Padam amounts.");return;}
    const parsedAmount = Number(amount);
    if (!selectedRetailerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Add collection details", "Choose a retailer and enter a valid amount.");
      return;
    }
    if (reference.trim().length < 3 && !receipt) {
      Alert.alert("Reference required", "Add a receipt, cheque, bank, or UPI reference before submitting.");
      return;
    }
    submitting.current=true;setSaving(true);
    try {
      collectionKey.current ??= `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await repApi.submitCollection({ retailerId: selectedRetailerId, amount: parsedAmount, method, reference: reference.trim() || undefined, notes: notes.trim() || undefined, evidence: receipt ? { contentType: receipt.contentType, bodyBase64: receipt.bodyBase64 } : undefined, idempotencyKey: collectionKey.current,...(invoiceId?{invoiceScopeId:invoiceId,jainAmount:jain,padamAmount:padam}:{}) });
      collectionKey.current=null;setAllocationConfirmed(false);
      setAmount(""); setReference(""); setNotes(""); setReceipt(null);
      Alert.alert("Submitted", "Accounts will verify this collection before it affects the ledger.");
      await load();
    } catch (error) {
      Alert.alert("Could not submit", error instanceof Error ? error.message : "Try again.");
    } finally { submitting.current=false;setSaving(false); }
  };

  const pickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const bodyBase64 = await new File(asset.uri).base64();
      setReceipt({ name: asset.name, uri: asset.uri, contentType: asset.mimeType ?? "application/pdf", bodyBase64 });
    } catch (error) {
      Alert.alert("Could not attach receipt", error instanceof Error ? error.message : "Try again.");
    }
  };

  const pickReceiptImage = async (source: "camera" | "library") => {
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Camera permission needed", "Allow camera access to photograph collection proof.");
          return;
        }
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 });
      if (result.canceled) return;
      setReceipt(toCollectionReceipt(result.assets[0]));
    } catch (error) {
      const message = error instanceof Error && error.message === "proof_too_large"
        ? "Proof image must be 10 MB or smaller."
        : error instanceof Error ? error.message : "Try again.";
      Alert.alert("Could not attach receipt", message);
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
      <KeyboardSafeScrollView containerStyle={styles.screen} contentContainerStyle={styles.content}>
        {capabilities.canCollect ? <View style={styles.card}>
          <View style={styles.cardTitleRow}><View style={styles.icon}><Ionicons name="cash-outline" size={22} color={colors.green} /></View><View><Text style={styles.title}>{t("work.submitCollection")}</Text><Text style={styles.muted}>{t("work.accountsVerify")}</Text></View></View>
          <Text style={styles.label}>Retailer</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Select retailer" accessibilityState={{ expanded: retailerPickerOpen }} disabled={saving || retailers.length === 0} onPress={() => setRetailerPickerOpen((open) => !open)} style={styles.retailerPickerButton}>
            <View style={styles.retailerPickerText}><Text style={styles.retailerName}>{selectedRetailer?.name ?? "Select retailer"}</Text>{selectedRetailer ? <Text style={styles.muted}>{selectedRetailer.shopAddress || selectedRetailer.phone}</Text> : null}</View>
            <Ionicons name={retailerPickerOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.inkMuted} />
          </TouchableOpacity>
          {retailers.length === 0 ? <Text style={styles.muted}>No retailers are assigned for collections. Ask an administrator to grant collection rights for a store.</Text> : null}
          {retailerPickerOpen ? <View style={styles.retailerPickerList}>
            <TextInput accessibilityLabel="Search assigned retailers" value={retailerQuery} onChangeText={setRetailerQuery} autoCapitalize="none" placeholder="Search name, phone or address" placeholderTextColor={colors.inkFaint} style={styles.input} />
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.retailerResults}>
              {visibleRetailers.map((retailer) => <TouchableOpacity key={retailer.id} accessibilityRole="button" accessibilityLabel={`Select ${retailer.name}`} onPress={() => chooseRetailer(retailer)} style={styles.retailerResult}>
                <Text style={styles.retailerName}>{retailer.name}</Text>
                <Text style={styles.muted}>{[retailer.shopAddress, retailer.phone].filter(Boolean).join(" · ")}</Text>
              </TouchableOpacity>)}
              {visibleRetailers.length === 0 ? <Text style={styles.emptyRetailerSearch}>No assigned retailers match your search.</Text> : null}
            </ScrollView>
          </View> : null}
          <Text style={styles.label}>Amount (₹)</Text>
          {invoices.map(i=><TouchableOpacity key={i.id} disabled={saving} style={styles.attachment} onPress={()=>{setInvoiceId(i.id);setJain("");setPadam("");setAllocationConfirmed(false);}}><Text>Invoice #{i.invoiceNumber} {invoiceId===i.id?"· Selected":""} · Jain ₹{i.jain} · Padam ₹{i.padam}</Text></TouchableOpacity>)}
          {invoiceId ? <>
            <Text style={styles.label}>Jain allocation (this invoice)</Text><TextInput editable={!saving} value={jain} onChangeText={v=>{setJain(v);setAllocationConfirmed(false);}} keyboardType="decimal-pad" style={styles.input}/>
            <Text style={styles.label}>Padam allocation (this invoice)</Text><TextInput editable={!saving} value={padam} onChangeText={v=>{setPadam(v);setAllocationConfirmed(false);}} keyboardType="decimal-pad" style={styles.input}/>
            <TouchableOpacity disabled={saving} style={styles.attachment} onPress={()=>{const i=invoices.find(i=>i.id===invoiceId);setAmount(i.total);setJain(i.jain);setPadam(i.padam);setAllocationConfirmed(false);}}><Text>Prefill full invoice payment</Text></TouchableOpacity>
            <TouchableOpacity disabled={saving} accessibilityRole="checkbox" accessibilityState={{checked:allocationConfirmed}} style={styles.attachment} onPress={()=>setAllocationConfirmed(!allocationConfirmed)}><Text>{allocationConfirmed?"Confirmed":"Tap to confirm"}: invoice and company allocation</Text></TouchableOpacity>
          </> : null}
          <TextInput value={amount} onChangeText={value=>{setAmount(value);setAllocationConfirmed(false);}} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.inkFaint} style={styles.input} />
          <Text style={styles.label}>Method</Text>
          <View style={styles.methodRow}>{methods.map((value) => <TouchableOpacity key={value} onPress={() => setMethod(value)} style={[styles.method, method === value && styles.methodActive]}><Text style={[styles.methodText, method === value && styles.methodTextActive]}>{value.toUpperCase()}</Text></TouchableOpacity>)}</View>
          <Text style={styles.label}>{t("work.collectionReference")}</Text>
          <TextInput editable={!saving} value={reference} onChangeText={setReference} placeholder={referencePlaceholder} placeholderTextColor={colors.inkFaint} style={styles.input} />
          <Text style={styles.label}>{t("work.collectionNotes")}</Text>
          <TextInput editable={!saving} value={notes} onChangeText={setNotes} maxLength={500} multiline textAlignVertical="top" placeholder={t("common.optional")} placeholderTextColor={colors.inkFaint} style={[styles.input, styles.notesInput]} />
          <Text style={styles.label}>Payment proof (optional)</Text>
          <View style={styles.receiptActions}>
            <TouchableOpacity disabled={saving} accessibilityRole="button" onPress={() => void pickReceiptImage("camera")} style={styles.receiptAction}>
              <Ionicons name="camera-outline" size={17} color={colors.green} /><Text style={styles.receiptActionText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={saving} accessibilityRole="button" onPress={() => void pickReceiptImage("library")} style={styles.receiptAction}>
              <Ionicons name="image-outline" size={17} color={colors.green} /><Text style={styles.receiptActionText}>Choose image</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={saving} accessibilityRole="button" onPress={() => void pickReceipt()} style={styles.receiptAction}>
              <Ionicons name="attach-outline" size={17} color={colors.green} /><Text style={styles.receiptActionText}>Choose file</Text>
            </TouchableOpacity>
          </View>
          {receipt ? <View style={styles.receiptPreview}>
            {receipt.contentType.startsWith("image/") ? <Image source={{ uri: receipt.uri }} accessibilityLabel="Payment proof preview" resizeMode="cover" style={styles.receiptImage} /> : <View style={styles.receiptFile}><Ionicons name="document-text-outline" size={22} color={colors.green} /><Text style={styles.receiptFileText}>PDF</Text></View>}
            <View style={styles.receiptInfo}><Text numberOfLines={2} style={styles.attachmentText}>{receipt.name}</Text><Text style={styles.muted}>Ready to upload with this collection</Text></View>
            <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="Remove payment proof" onPress={() => setReceipt(null)} style={styles.removeReceipt}><Ionicons name="close-circle-outline" size={21} color={colors.inkMuted} /></TouchableOpacity>
          </View> : <Text style={styles.muted}>Add an image or PDF to this collection submission.</Text>}
          <TouchableOpacity disabled={saving} onPress={submit} style={styles.primary}><Text style={styles.primaryText}>{saving ? t("collections.submitting") : t("collections.submit")}</Text></TouchableOpacity>
        </View> : null}

        {canConfirmCollections ? <View style={styles.card}>
          <View style={styles.cardTitleRow}><View style={styles.icon}><Ionicons name="checkmark-done-outline" size={22} color={colors.green} /></View><View><Text style={styles.title}>{t("collections.accountsQueue")}</Text><Text style={styles.muted}>{submissions.length} pending verification{stepUpChallenge ? " · verification active" : ""}</Text></View></View>
          {submissions.map((submission) => <View key={submission.id} style={styles.queueRow}><View style={{ flex: 1 }}><Text style={styles.queueTitle}>{submission.retailer.name}</Text><Text style={styles.muted}>₹{Number(submission.amount).toLocaleString("en-IN")} · {submission.method}</Text></View><TouchableOpacity onPress={stepUpChallenge ? () => void confirm(submission.id) : () => void startConfirm()} style={styles.smallButton}><Text style={styles.smallButtonText}>{stepUpChallenge ? "Confirm" : "Verify"}</Text></TouchableOpacity></View>)}
          {stepUpChallenge ? <TextInput value={stepUpOtp} onChangeText={setStepUpOtp} keyboardType="number-pad" placeholder="Enter OTP" placeholderTextColor={colors.inkFaint} style={styles.input} /> : null}
          {submissions.length === 0 ? <Text style={styles.muted}>{t("work.noCollections")}</Text> : null}
        </View> : null}

        {!capabilities.canCollect && !canConfirmCollections ? <View style={styles.card}><Text style={styles.title}>Your staff access is active</Text><Text style={styles.muted}>No operational workspace has been assigned yet. Ask your administrator if you need another role.</Text></View> : null}
      </KeyboardSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12.5, lineHeight: 18, color: colors.inkMuted },
  label: { fontSize: 12, fontWeight: "700", color: colors.inkMuted, marginTop: spacing.sm },
  retailerPickerButton: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  retailerPickerText: { flex: 1, gap: 2 },
  retailerName: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  retailerPickerList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  retailerResults: { maxHeight: 260 },
  retailerResult: { minHeight: 52, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, justifyContent: "center", gap: 2 },
  emptyRetailerSearch: { color: colors.inkMuted, padding: spacing.md },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.ink, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  notesInput: { minHeight: 88 },
  methodRow: { flexDirection: "row", gap: spacing.sm },
  method: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.sm },
  methodActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  methodText: { color: colors.inkMuted, fontSize: 11, fontWeight: "700" },
  methodTextActive: { color: colors.green },
  primary: { backgroundColor: colors.green, borderRadius: radius.md, alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  primaryText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },
  attachment: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  attachmentText: { color: colors.green, fontSize: 12.5, fontWeight: "700", flex: 1 },
  receiptActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  receiptAction: { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.surface },
  receiptActionText: { color: colors.green, fontSize: 12, fontWeight: "700" },
  receiptPreview: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  receiptImage: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  receiptFile: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", gap: 2 },
  receiptFileText: { color: colors.green, fontSize: 10, fontWeight: "700" },
  receiptInfo: { flex: 1, gap: 3 },
  removeReceipt: { minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" },
  queueRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  queueTitle: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  smallButton: { backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  smallButtonText: { color: colors.green, fontWeight: "700", fontSize: 12 },
});
