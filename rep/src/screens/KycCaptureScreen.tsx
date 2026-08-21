import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { repApi } from "../api/repClient";
import { colors, radius, spacing } from "../theme";

const REQUIRED = [
  ["business_registration", "Business registration"],
  ["identity_proof", "Identity proof"],
  ["address_proof", "Address proof"],
] as const;

export default function KycCaptureScreen({ route }: any) {
  const { retailerId, retailerName } = route.params;
  const [kyc, setKyc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const retailer = await repApi.retailer(retailerId);
      if (retailer.kyc?.id) setKyc(await repApi.kycCase(retailer.kyc.id).then((result) => result.kycCase));
      else setKyc(await repApi.startKyc(retailerId).then((result) => result.kycCase));
      setError("");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [retailerId]);
  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  const pick = async (type: string) => {
    if (!kyc) return;
    setBusy(type); setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const base64 = await new File(asset.uri).base64();
      const response = await repApi.uploadKycDocument(kyc.id, { type, contentType: asset.mimeType ?? "application/pdf", bodyBase64: base64 });
      setKyc(await repApi.kycCase(response.document.caseId ?? kyc.id).then((item) => item.kycCase));
    } catch (err: any) { setError(err.message); }
    finally { setBusy(null); }
  };

  const submit = async () => {
    if (!kyc) return;
    setBusy("submit");
    try { setKyc((await repApi.submitKyc(kyc.id)).kycCase); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(null); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green} /></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>KYC for {retailerName}</Text>
    <Text style={styles.sub}>Capture clear copies. Files are encrypted and visible only to authorized ops reviewers.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {REQUIRED.map(([type, label]) => {
      const uploaded = kyc?.documents?.some((document: any) => document.type === type);
      return <View style={styles.card} key={type}><View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={uploaded ? styles.done : styles.required}>{uploaded ? "Uploaded" : "Required"}</Text></View><TouchableOpacity disabled={busy !== null || kyc?.status === "submitted"} style={styles.button} onPress={() => void pick(type)}><Text style={styles.buttonText}>{busy === type ? "Uploading…" : uploaded ? "Replace document" : "Choose document"}</Text></TouchableOpacity></View>;
    })}
    {kyc?.status === "draft" || kyc?.status === "rejected" ? <TouchableOpacity disabled={busy !== null || kyc?.documents?.length < 3} style={[styles.submit, (busy !== null || kyc?.documents?.length < 3) && styles.disabled]} onPress={() => void submit()}><Text style={styles.submitText}>{busy === "submit" ? "Submitting…" : "Submit for review"}</Text></TouchableOpacity> : <Text style={styles.status}>Case status: {kyc?.status}</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.lg, paddingBottom: 48 }, center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink }, sub: { color: colors.inkMuted, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.lg }, error: { color: colors.danger, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, label: { color: colors.ink, fontWeight: "700" }, required: { color: colors.danger, fontSize: 12 }, done: { color: colors.green, fontSize: 12, fontWeight: "700" },
  button: { backgroundColor: colors.greenSoft, padding: spacing.md, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md }, buttonText: { color: colors.green, fontWeight: "700" }, submit: { backgroundColor: colors.greenDeep, padding: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.sm }, submitText: { color: colors.onDark, fontWeight: "800" }, disabled: { opacity: 0.45 }, status: { color: colors.green, fontWeight: "700", marginTop: spacing.md },
});
