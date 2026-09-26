import React, { useCallback, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing } from "../theme";
import { ScreenHeader } from "../components/ui";
import {
  feedbackSubjectLabel,
  prepareFeedbackSubmission,
  readPendingFeedback,
  sendFeedbackAttempt,
  type FeedbackRow,
  type PendingFeedback,
} from "../lib/salespersonFeedbackSubmission";

export default function SalespersonFeedbackScreen() {
  const { retailer } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [assignment, setAssignment] = useState<{ id: string; name: string } | null>(null);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<PendingFeedback | null | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const result = await api.salespersonFeedback(cursor);
      setAssignment(result.assignment);
      setFeedback((current) => cursor
        ? [...current, ...result.feedback.filter((row: FeedbackRow) => !current.some((existing) => existing.id === row.id))]
        : result.feedback);
      setNextCursor(result.nextCursor);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setPending(undefined);
    setStorageError(false);
    if (retailer?.id) {
      void readPendingFeedback(AsyncStorage, retailer.id).then((saved) => {
        if (!active) return;
        setPending(saved);
        if (saved) setDescription(saved.description);
      }).catch(() => {
        if (active) setStorageError(true);
      });
    } else {
      setPending(null);
    }
    void load();
    return () => { active = false; };
  }, [retailer?.id, load]));

  const submit = async () => {
    if (!retailer || submitting.current || pending === undefined || storageError) return;
    const value = description.trim();
    if (!pending && (!assignment || loadError)) {
      Alert.alert("Salesperson unavailable", "Refresh the page before sending feedback.");
      return;
    }
    if (!pending && value.length < 3) {
      Alert.alert("Add some detail", "Describe your experience with your assigned salesperson.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const attempt = await prepareFeedbackSubmission(AsyncStorage, pending ?? {
        retailerId: retailer.id,
        description: value,
        clientReference: `retailer-feedback-${retailer.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        expectedSalesRepId: assignment!.id,
        expectedSalesRepName: assignment!.name,
      });
      setPending(attempt);
      setDescription(attempt.description);
      const outcome = await sendFeedbackAttempt(AsyncStorage, attempt, {
        submit: api.submitSalespersonFeedback,
        byReference: api.salespersonFeedbackByReference,
        list: () => api.salespersonFeedback(),
      });
      if (outcome.kind === "submitted") {
        setPending(null);
        setDescription("");
        setFeedback((current) => outcome.page
          ? [outcome.feedback, ...outcome.page.feedback.filter((row) => row.id !== outcome.feedback.id)]
          : [outcome.feedback, ...current.filter((row) => row.id !== outcome.feedback.id)]);
        if (outcome.page) {
          setAssignment(outcome.page.assignment);
          setNextCursor(outcome.page.nextCursor);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
        Keyboard.dismiss();
        Alert.alert("Feedback submitted", "Your feedback is saved for the Gagan team.");
      } else if (outcome.kind === "assignment_changed") {
        setPending(null);
        await load();
        Alert.alert("Assigned salesperson changed", "Review the current salesperson before submitting new feedback.");
      } else {
        Alert.alert("Submission not confirmed", "Retry the same feedback to avoid sending a duplicate.");
      }
    } catch {
      setStorageError(true);
      Alert.alert("Could not save feedback locally", "Please try again before sending feedback.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const canCompose = pending === null && Boolean(assignment) && !loadError && !storageError;
  const submitDisabled = busy || pending === undefined || storageError || (!pending && !canCompose);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Salesperson feedback" subtitle="Share your experience with your assigned salesperson" />
        <View style={styles.card}>
          <Text style={styles.title}>New feedback</Text>
          <Text style={styles.subject}>
            {feedbackSubjectLabel(pending, assignment, loading)}
          </Text>
          {pending ? <Text style={styles.warning}>Submission status uncertain. Retry this same feedback.</Text> : null}
          {storageError ? <Text style={styles.warning}>Saved feedback cannot be checked right now. Reopen this page before submitting.</Text> : null}
          {!assignment && !loading ? <Text style={styles.muted}>Ask the Gagan team to confirm your assigned salesperson.</Text> : null}
          <TextInput
            style={[styles.input, !canCompose && styles.readOnly]}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            placeholder="Describe your experience"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Salesperson feedback details"
            value={description}
            editable={canCompose && !busy}
            onChangeText={setDescription}
          />
          <Pressable style={[styles.button, submitDisabled && styles.disabled]} disabled={submitDisabled} accessibilityRole="button" onPress={() => void submit()}>
            <Text style={styles.buttonText}>{busy ? "Submitting..." : pending ? "Retry same feedback" : "Submit feedback"}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onDark} />
          </Pressable>
        </View>
        <View style={styles.headingRow}>
          <Text style={styles.title}>Feedback history</Text>
          <Pressable onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Refresh salesperson feedback">
            <Ionicons name="refresh" size={20} color={colors.green} />
          </Pressable>
        </View>
        {loadError ? <Text style={styles.notice}>{feedback.length ? "Could not refresh feedback. Your previous history is still shown." : "Could not load feedback. Check your connection and retry."}</Text> : null}
        {loading && feedback.length === 0 ? <Text style={styles.notice}>Loading feedback...</Text> : null}
        {!loading && !loadError && feedback.length === 0 ? <Text style={styles.notice}>No feedback yet.</Text> : null}
        {feedback.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.subject}>{row.salesRep.name}</Text>
              <Text style={styles.muted}>{new Date(row.createdAt).toLocaleDateString("en-IN")}</Text>
            </View>
            <Text style={styles.description}>{row.description}</Text>
          </View>
        ))}
        {nextCursor ? (
          <Pressable style={styles.more} disabled={loading} accessibilityRole="button" onPress={() => void load(nextCursor)}>
            <Text style={styles.moreText}>{loading ? "Loading..." : "Load more"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  title: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  subject: { color: colors.greenDeep, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  muted: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  warning: { color: colors.error, fontSize: 13, lineHeight: 19 },
  notice: { color: colors.inkMuted, fontSize: 13, lineHeight: 19, marginHorizontal: spacing.lg },
  input: { minHeight: 90, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.bg, fontSize: 15 },
  readOnly: { opacity: 0.7 },
  button: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.greenDeep },
  buttonText: { color: colors.onDark, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  headingRow: { marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  description: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  more: { minHeight: 44, alignItems: "center", justifyContent: "center", marginHorizontal: spacing.lg },
  moreText: { color: colors.greenDeep, fontSize: 14, fontWeight: "700" },
});
