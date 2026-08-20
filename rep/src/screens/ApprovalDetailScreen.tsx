import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { repApi } from "../api/repClient";
import { colors, inr, radius, spacing } from "../theme";
import { useRep } from "../context/RepContext";

const reasonLabel = (code: string) => ({
  new_customer_second_invoice: "Second invoice approval",
  new_customer_third_invoice: "Third invoice approval",
  new_customer_50000_cap: "New-customer ₹50,000 cap",
  so_price_list_variation: "Sales-order price variation",
  previous_invoice_pending: "Previous invoice pending",
  one_or_more_outstanding: "Outstanding invoices present",
  repeated_monthly_approval: "Repeated approval this month",
}[code] ?? code.replaceAll("_", " "));

export default function ApprovalDetailScreen({ route, navigation }: any) {
  const { staff } = useRep();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);
  const openDispute = request?.disputes?.find((item: any) => item.status !== "resolved");
  const canResolveDispute = (staff?.permissions ?? []).some((permission: string) =>
    ["approval.third_invoice", "legal.decide"].includes(permission)
  );

  useEffect(() => {
    repApi.approval(route.params.approvalId)
      .then((result) => setRequest(result.request))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load approval"))
      .finally(() => setLoading(false));
  }, [route.params.approvalId]);

  const begin = async (result: "approved" | "rejected") => {
    if (openDispute && reason.trim().length < 10) {
      setError("Add the factual resolution before closing the dispute.");
      return;
    }
    if (result === "rejected" && reason.trim().length < 3) {
      setError("Add a clear rejection reason.");
      return;
    }
    try {
      const challenge = await repApi.requestStepUp();
      setChallengeId(challenge.challengeId);
      setPendingDecision(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify identity");
    }
  };

  const decide = async () => {
    if (!pendingDecision || otp.length !== 6) return;
    try {
      await repApi.completeStepUp(challengeId, otp);
      if (openDispute && canResolveDispute) {
        await repApi.resolveApprovalDispute(openDispute.id, pendingDecision, reason.trim());
      } else {
        await repApi.decideApproval(request.id, pendingDecision, reason.trim() || undefined);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision could not be saved");
    }
  };

  const raiseDispute = async () => {
    if (reason.trim().length < 10) {
      setError("Add a written position with supporting context.");
      return;
    }
    try {
      await repApi.raiseApprovalDispute(request.id, reason.trim());
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispute could not be opened");
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.green} /></View>;
  if (!request) return <View style={styles.center}><Text style={styles.error}>{error || "Approval not found"}</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>{request.retailer.name}</Text>
      <Text style={styles.title}>Order #{request.order?.orderNo}</Text>
      <View style={styles.exposure}>
        <Text style={styles.exposureValue}>{inr(Number(request.assessment.projectedExposure))}</Text>
        <Text style={styles.exposureLabel}>Projected exposure · {inr(Number(request.order?.orderTotal ?? 0))} order</Text>
      </View>
      <Text style={styles.section}>Why approval is needed</Text>
      {request.assessment.reasons.map((code: string) => <View style={styles.reason} key={code}><Text style={styles.reasonText}>{reasonLabel(code)}</Text></View>)}
      <Text style={styles.label}>{request.status === "rejected" ? "Written position" : "Decision note"}</Text>
      <TextInput style={styles.note} multiline value={reason} onChangeText={setReason} placeholder={request.status === "rejected" ? "Add supporting facts for the dispute" : "Required when rejecting"} placeholderTextColor={colors.inkFaint} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {request.status === "rejected" ? (
        <View style={styles.verify}>
          {openDispute ? <>
            <Text style={styles.section}>{canResolveDispute ? "Resolve written dispute" : "Dispute under review"}</Text>
            <Text style={styles.copy}>{openDispute.writtenPosition}</Text>
            {canResolveDispute ? (!pendingDecision ? <View style={styles.actions}>
              <TouchableOpacity style={styles.reject} onPress={() => void begin("rejected")}><Text style={styles.rejectText}>Uphold rejection</Text></TouchableOpacity>
              <TouchableOpacity style={styles.approve} onPress={() => void begin("approved")}><Text style={styles.approveText}>Approve</Text></TouchableOpacity>
            </View> : <>
              <Text style={styles.copy}>Enter the six-digit verification code.</Text>
              <TextInput style={styles.otp} keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ""))} />
              <TouchableOpacity disabled={otp.length !== 6} style={[styles.approve, otp.length !== 6 && styles.disabled]} onPress={() => void decide()}><Text style={styles.approveText}>Verify and close dispute</Text></TouchableOpacity>
            </>) : null}
          </> : <>
            <Text style={styles.section}>Order remains held</Text>
            <Text style={styles.copy}>Opening a dispute does not authorize dispatch.</Text>
            <TouchableOpacity style={styles.approve} onPress={() => void raiseDispute()}><Text style={styles.approveText}>Open dispute</Text></TouchableOpacity>
          </>}
        </View>
      ) : !pendingDecision ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.reject} onPress={() => void begin("rejected")}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity>
          <TouchableOpacity style={styles.approve} onPress={() => void begin("approved")}><Text style={styles.approveText}>Approve</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.verify}>
          <Text style={styles.section}>Verify decision</Text>
          <Text style={styles.copy}>Enter the six-digit code sent to your registered phone.</Text>
          <TextInput style={styles.otp} keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, ""))} />
          <TouchableOpacity disabled={otp.length !== 6} style={[styles.approve, otp.length !== 6 && styles.disabled]} onPress={() => void decide()}><Text style={styles.approveText}>Verify and {pendingDecision === "approved" ? "approve" : "reject"}</Text></TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  eyebrow: { color: colors.green, fontSize: 12, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 5 },
  exposure: { backgroundColor: colors.cream, borderRadius: radius.lg, padding: spacing.lg, marginVertical: spacing.xl },
  exposureValue: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  exposureLabel: { color: colors.inkMuted, fontSize: 12.5, marginTop: 4 },
  section: { color: colors.ink, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm },
  reason: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  reasonText: { color: colors.ink, fontWeight: "600", textTransform: "capitalize" },
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "600", marginTop: spacing.lg, marginBottom: 6 },
  note: { minHeight: 86, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.ink, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  reject: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: 14, alignItems: "center" },
  rejectText: { color: colors.danger, fontWeight: "800" },
  approve: { flex: 1, backgroundColor: colors.green, borderRadius: radius.md, padding: 14, alignItems: "center" },
  approveText: { color: colors.onDark, fontWeight: "800" },
  verify: { backgroundColor: colors.greenSoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
  copy: { color: colors.inkMuted, fontSize: 12.5, marginBottom: spacing.md },
  otp: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, fontSize: 20, letterSpacing: 8, textAlign: "center", color: colors.ink, marginBottom: spacing.md },
  disabled: { opacity: .45 },
  error: { color: colors.danger, marginTop: spacing.md },
});
