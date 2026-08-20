import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { repApi } from "../api/repClient";
import { colors, radius, spacing } from "../theme";

export default function RatingReviewsScreen() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    try { setProposals((await repApi.ratingProposals()).proposals); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load reviews"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const begin = async (id: string) => {
    if (reason.trim().length < 5) return setError("Add a confirmation reason.");
    try { const challenge = await repApi.requestStepUp(); setChallengeId(challenge.challengeId); setSelected(id); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not verify identity"); }
  };
  const confirm = async () => {
    if (!selected || otp.length !== 6) return;
    try {
      await repApi.completeStepUp(challengeId, otp);
      await repApi.confirmRatingProposal(selected, reason.trim());
      setSelected(null); setOtp(""); setReason(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not confirm rating"); }
  };
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green} /></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {proposals.length === 0 ? <Text style={styles.empty}>No rating changes need review.</Text> : proposals.map((proposal) => <View style={styles.card} key={proposal.id}>
      <Text style={styles.name}>{proposal.creditProfile.retailer.name}</Text>
      <Text style={styles.rating}>{proposal.previousRating} → {proposal.proposedRating}</Text>
      <Text style={styles.meta}>{proposal.trigger.replaceAll("_", " ")} · DSO {proposal.evidence.averageDso ?? "—"} days · {proposal.evidence.cleanInvoiceCount ?? 0} clean invoices</Text>
      <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Confirmation reason" placeholderTextColor={colors.inkFaint} />
      {selected === proposal.id ? <View style={styles.verify}><TextInput style={styles.otp} keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ""))} /><TouchableOpacity style={styles.button} disabled={otp.length !== 6} onPress={() => void confirm()}><Text style={styles.buttonText}>Verify and confirm</Text></TouchableOpacity></View> : <TouchableOpacity style={styles.button} onPress={() => void begin(proposal.id)}><Text style={styles.buttonText}>Confirm rating</Text></TouchableOpacity>}
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: spacing.lg, gap: spacing.md }, center: { flex: 1, justifyContent: "center", backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  name: { color: colors.ink, fontWeight: "700" }, rating: { color: colors.green, fontSize: 23, fontWeight: "800", marginVertical: 7 }, meta: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18, textTransform: "capitalize" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, marginTop: spacing.lg },
  verify: { marginTop: spacing.md }, otp: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, textAlign: "center", letterSpacing: 8, fontSize: 19, marginBottom: spacing.sm },
  button: { backgroundColor: colors.green, borderRadius: radius.md, padding: 13, alignItems: "center", marginTop: spacing.md }, buttonText: { color: colors.onDark, fontWeight: "800" }, error: { color: colors.danger }, empty: { color: colors.inkMuted, textAlign: "center", marginTop: 40 },
});
