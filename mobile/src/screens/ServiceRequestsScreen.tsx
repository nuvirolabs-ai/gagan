import React, { useCallback, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing } from "../theme";
import { ScreenHeader } from "../components/ui";
import { canWithdrawServiceRequest, mergeServiceRequest, type ServiceRequestRow } from "../lib/serviceRequestState";

export default function ServiceRequestsScreen() {
  const { retailer } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const clientReference = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.serviceRequests();
      setRequests(result.requests ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const submit = async () => {
    const value = description.trim();
    if (!retailer || value.length < 3 || busy) {
      if (value.length < 3) Alert.alert("Add some detail", "Describe what the service team should help with.");
      return;
    }
    if (!clientReference.current) clientReference.current = `retailer-service-${retailer.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setBusy(true);
    try {
      const result = await api.submitServiceRequest(value, clientReference.current);
      setRequests((current) => [result.request, ...current.filter((row) => row.id !== result.request.id)]);
      setDescription("");
      clientReference.current = null;
      Keyboard.dismiss();
      Alert.alert("Request submitted", "Your Gagan service team can now review it.");
    } catch {
      Alert.alert("Could not submit", "Check your connection and retry. Your request text is still here.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = (request: ServiceRequestRow) => {
    if (!canWithdrawServiceRequest(request) || withdrawing) return;
    Alert.alert("Withdraw this request?", "This will close the request for the service team. It will remain in your history.", [
      { text: "Keep Request", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: async () => {
        setWithdrawing(request.id);
        try {
          const result = await api.withdrawServiceRequest(request.id);
          setRequests((current) => mergeServiceRequest(current, result.request));
        } catch {
          Alert.alert("Could not withdraw", "The request may already be in progress. Refresh to see its current status.");
          await load();
        } finally {
          setWithdrawing(null);
        }
      } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Service requests" subtitle="Ask the Gagan team for help" />
        <View style={styles.card}>
          <Text style={styles.title}>New request</Text>
          <Text style={styles.muted}>Tell us what happened or what you need.</Text>
          <TextInput
            style={styles.input}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            placeholder="Describe your request"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Service request details"
            value={description}
            onChangeText={(value) => { setDescription(value); clientReference.current = null; }}
          />
          <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy} accessibilityRole="button" onPress={() => void submit()}>
            <Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit request"}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onDark} />
          </Pressable>
        </View>
        <View style={styles.headingRow}>
          <Text style={styles.title}>Request history</Text>
          <Pressable onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Refresh service requests"><Ionicons name="refresh" size={20} color={colors.green} /></Pressable>
        </View>
        {loadError ? <Text style={styles.muted}>Could not refresh requests. Your previous list is still shown.</Text> : null}
        {loading && requests.length === 0 ? <Text style={styles.muted}>Loading requests…</Text> : null}
        {!loading && requests.length === 0 ? <Text style={styles.muted}>No service requests yet.</Text> : null}
        {requests.map((request) => (
          <View key={request.id} style={styles.card}>
            <View style={styles.headingRow}>
              <Text style={styles.status}>{request.status.replace(/_/g, " ")}</Text>
              <Text style={styles.muted}>{new Date(request.createdAt).toLocaleDateString("en-IN")}</Text>
            </View>
            <Text style={styles.description}>{request.description}</Text>
            {canWithdrawServiceRequest(request) ? (
              <Pressable accessibilityRole="button" disabled={withdrawing === request.id} onPress={() => withdraw(request)}>
                <Text style={styles.withdraw}>{withdrawing === request.id ? "Withdrawing…" : "Withdraw Request"}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  title: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  muted: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 90, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.bg, fontSize: 15 },
  button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.greenDeep },
  buttonText: { color: colors.onDark, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  headingRow: { marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  status: { color: colors.greenDeep, fontWeight: "700", textTransform: "capitalize" },
  description: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  withdraw: { color: colors.error, fontSize: 14, fontWeight: "700", paddingVertical: spacing.sm },
});
