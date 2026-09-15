import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { AppScreen, EmptyState, PrimaryButton, SectionHeader, StatusChip, Surface } from "../components/ui";
import { colors, radius, spacing } from "../theme";
import { haptic } from "../feedback/haptics";

type Answer = { optionIds?: string[]; value?: string | number | boolean | null };

export default function MarketSurveysScreen({ route, navigation }: any) {
  const contextRetailerId = route.params?.retailerId as string | undefined;
  const { staff } = useRep();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"available" | "submitted">("available");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await repApi.surveys(contextRetailerId);
      setSurveys(result.surveys ?? []);
    } catch {
      setSurveys([]);
    } finally { setLoading(false); }
  }, [contextRetailerId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = async (survey: any) => {
    try {
      const result = await repApi.survey(survey.id, contextRetailerId);
      setSelected(result);
      setAnswers({});
      setIdempotencyKey(`survey-${staff?.id ?? "staff"}-${survey.id}-${Date.now()}`);
    } catch { Alert.alert("Survey unavailable", "This survey is no longer available for your current context."); }
  };

  const visible = useMemo(() => surveys.filter((survey) => filter === "submitted" ? Boolean(survey.submittedAt) : !survey.submittedAt), [filter, surveys]);

  const setAnswer = (questionId: string, answer: Answer) => setAnswers((current) => ({ ...current, [questionId]: answer }));

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const requestKey = idempotencyKey ?? `survey-${staff?.id ?? "staff"}-${selected.survey.id}-${Date.now()}`;
      setIdempotencyKey(requestKey);
      const result = await repApi.submitSurvey(selected.survey.id, {
        idempotencyKey: requestKey,
        retailerId: contextRetailerId,
        answers: selected.survey.questions.map((question: any) => ({ questionId: question.id, ...(answers[question.id] ?? {}) })),
      });
      haptic("success");
      Alert.alert(result.replayed ? "Already submitted" : "Survey submitted", result.replayed ? "Your saved response is still recorded." : "Thanks — your answers are now with your manager.", [{ text: "Done", onPress: () => { setSelected(null); setIdempotencyKey(null); void load(); } }]);
    } catch (error: any) { Alert.alert("Could not submit", error?.message ?? "Check your answers and try again."); }
    finally { setSubmitting(false); }
  };

  if (selected) {
    const survey = selected.survey;
    const existing = selected.response;
    return <AppScreen><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Pressable style={styles.back} onPress={() => { setSelected(null); setIdempotencyKey(null); }}><Ionicons name="arrow-back" size={19} color={colors.blue} /><Text style={styles.backText}>All surveys</Text></Pressable><Text style={styles.kicker}>MARKET SURVEY</Text><Text style={styles.title}>{survey.title}</Text>{survey.description ? <Text style={styles.subtitle}>{survey.description}</Text> : null}{contextRetailerId ? <StatusChip label="Retailer context" tone="info" /> : null}{existing ? <Surface level={1}><Text style={styles.doneTitle}>Submitted</Text><Text style={styles.muted}>This response is final and can be reviewed by your manager.</Text>{existing.answers.map((answer: any) => <View key={answer.questionId} style={styles.answerSummary}><Text style={styles.question}>{answer.prompt}</Text><Text style={styles.muted}>{answer.value ?? answer.options.map((option: any) => option.label).join(", ")}</Text></View>)}</Surface> : <>{survey.questions.map((question: any, index: number) => <Surface key={question.id} level={1}><Text style={styles.question}>{index + 1}. {question.prompt}{question.required ? <Text style={styles.required}> *</Text> : null}</Text>{question.type === "single_choice" ? <View style={styles.options}>{question.options.map((option: any) => { const active = answers[question.id]?.optionIds?.includes(option.id); return <Pressable key={option.id} style={[styles.option, active && styles.optionActive]} onPress={() => setAnswer(question.id, { optionIds: [option.id] })}><Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text></Pressable>; })}</View> : null}{question.type === "multiple_choice" ? <View style={styles.options}>{question.options.map((option: any) => { const current = answers[question.id]?.optionIds ?? []; const active = current.includes(option.id); return <Pressable key={option.id} style={[styles.option, active && styles.optionActive]} onPress={() => setAnswer(question.id, { optionIds: active ? current.filter((id) => id !== option.id) : [...current, option.id] })}><Ionicons name={active ? "checkbox" : "square-outline"} size={18} color={active ? colors.blue : colors.inkFaint} /><Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text></Pressable>; })}</View> : null}{question.type === "yes_no" ? <View style={styles.options}>{[true, false].map((value) => { const active = answers[question.id]?.value === value; return <Pressable key={String(value)} style={[styles.option, active && styles.optionActive]} onPress={() => setAnswer(question.id, { value })}><Text style={[styles.optionText, active && styles.optionTextActive]}>{value ? "Yes" : "No"}</Text></Pressable>; })}</View> : null}{question.type === "rating" ? <View style={styles.options}>{(() => { const min = Math.max(0, Math.ceil(Number(question.minValue ?? 1))); const max = Math.floor(Number(question.maxValue ?? 5)); return Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => min + i); })().map((value) => { const active = answers[question.id]?.value === value; return <Pressable key={value} style={[styles.rating, active && styles.ratingActive]} onPress={() => setAnswer(question.id, { value })}><Text style={[styles.ratingText, active && styles.ratingTextActive]}>{value}</Text></Pressable>; })}</View> : null}{question.type === "number" ? <TextInput style={styles.input} keyboardType="decimal-pad" value={answers[question.id]?.value == null ? "" : String(answers[question.id]?.value)} onChangeText={(value) => setAnswer(question.id, { value: value === "" ? null : Number(value) })} placeholder="Enter a number" placeholderTextColor={colors.inkFaint} /> : null}{question.type === "text" ? <TextInput style={[styles.input, styles.multiline]} multiline value={typeof answers[question.id]?.value === "string" ? answers[question.id]?.value as string : ""} onChangeText={(value) => setAnswer(question.id, { value })} placeholder="Write a short answer" placeholderTextColor={colors.inkFaint} /> : null}</Surface>)}<PrimaryButton label={submitting ? "Submitting…" : "Review and submit"} icon="checkmark-circle-outline" disabled={submitting} onPress={() => void submit()} /></>}</ScrollView></KeyboardAvoidingView></AppScreen>;
  }

  return <AppScreen><ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>FIELD INSIGHT</Text><Text style={styles.title}>Market surveys</Text><Text style={styles.subtitle}>Short questions from your manager. Answers are linked to your account{contextRetailerId ? " and this retailer" : ""}.</Text><View style={styles.filterRow}><Pressable style={[styles.filter, filter === "available" && styles.filterActive]} onPress={() => setFilter("available")}><Text style={[styles.filterText, filter === "available" && styles.filterTextActive]}>Available</Text></Pressable><Pressable style={[styles.filter, filter === "submitted" && styles.filterActive]} onPress={() => setFilter("submitted")}><Text style={[styles.filterText, filter === "submitted" && styles.filterTextActive]}>Submitted</Text></Pressable></View>{loading ? <Text style={styles.muted}>Loading surveys…</Text> : visible.length === 0 ? <EmptyState title={filter === "available" ? "Nothing to answer" : "No submitted surveys"} body={contextRetailerId ? "Try again from another assigned retailer or return later." : "Your manager's active surveys will appear here."} /> : visible.map((survey) => <Pressable key={survey.id} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={() => void open(survey)}><View style={styles.listIcon}><Ionicons name="clipboard-outline" size={20} color={colors.blue} /></View><View style={styles.listCopy}><Text style={styles.listTitle}>{survey.title}</Text><Text style={styles.muted}>{survey.questions.length} question{survey.questions.length === 1 ? "" : "s"}{survey.submittedAt ? ` · ${new Date(survey.submittedAt).toLocaleDateString("en-IN")}` : ""}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.inkFaint} /></Pressable>)}</ScrollView></AppScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  back: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 40 },
  backText: { color: colors.blue, fontWeight: "700" },
  kicker: { color: colors.blueInk, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.7 },
  subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.sm },
  filter: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterText: { color: colors.textSecondary, fontWeight: "700" },
  filterTextActive: { color: colors.onDark },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 70 },
  pressed: { opacity: 0.82 },
  listIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  listCopy: { flex: 1, gap: 3 },
  listTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  question: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  required: { color: colors.danger },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: 13, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionActive: { borderColor: colors.blue, backgroundColor: colors.primarySoft },
  optionText: { color: colors.textSecondary, fontWeight: "600" },
  optionTextActive: { color: colors.blueInk },
  rating: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ratingActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  ratingText: { color: colors.textSecondary, fontWeight: "700" },
  ratingTextActive: { color: colors.onDark },
  input: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, backgroundColor: colors.surface, fontSize: 15 },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  doneTitle: { color: colors.success, fontSize: 16, fontWeight: "700" },
  answerSummary: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
});
