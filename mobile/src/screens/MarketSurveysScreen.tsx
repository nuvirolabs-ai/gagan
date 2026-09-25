import React, { useCallback, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { EmptyState, ScreenHeader, StatusPill } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing } from "../theme";

type Answer = { optionIds?: string[]; value?: string | number | boolean | null };

export default function MarketSurveysScreen({ navigation }: any) {
  const { retailer } = useAuth();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"available" | "submitted">("available");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api.surveys(); setSurveys(result.surveys ?? []); }
    catch { setSurveys([]); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => surveys.filter((survey) => filter === "submitted" ? Boolean(survey.submittedAt) : !survey.submittedAt), [filter, surveys]);
  const open = async (survey: any) => {
    try { setSelected(await api.survey(survey.id)); setAnswers({}); setIdempotencyKey(`survey-${retailer?.id ?? "retailer"}-${survey.id}-${Date.now()}`); }
    catch { Alert.alert("Survey unavailable", "This survey is no longer open for your account."); }
  };
  const setAnswer = (questionId: string, answer: Answer) => setAnswers((current) => ({ ...current, [questionId]: answer }));
  const submit = async () => {
    if (!selected || !retailer) return;
    setSubmitting(true);
    try {
      const requestKey = idempotencyKey ?? `survey-${retailer.id}-${selected.survey.id}-${Date.now()}`;
      setIdempotencyKey(requestKey);
      const result = await api.submitSurvey(selected.survey.id, { idempotencyKey: requestKey, answers: selected.survey.questions.map((question: any) => ({ questionId: question.id, ...(answers[question.id] ?? {}) })) });
      Alert.alert(result.replayed ? "Already submitted" : "Survey submitted", result.replayed ? "Your saved response is still recorded." : "Thanks for sharing your view.", [{ text: "Done", onPress: () => { setSelected(null); setIdempotencyKey(null); void load(); } }]);
    } catch (error: any) { Alert.alert("Could not submit", error?.message ?? "Check your answers and try again."); }
    finally { setSubmitting(false); }
  };

  if (selected) {
    const survey = selected.survey;
    const existing = selected.response;
    return <View style={[styles.flex, { backgroundColor: colors.bg }]}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Pressable style={styles.back} onPress={() => { setSelected(null); setIdempotencyKey(null); }}><Ionicons name="arrow-back" size={19} color={colors.green} /><Text style={styles.backText}>All surveys</Text></Pressable><ScreenHeader title={survey.title} subtitle="Your response is linked to this store" />{survey.description ? <Text style={styles.subtitle}>{survey.description}</Text> : null}{existing ? <View style={styles.done}><StatusPill status="delivered" /><Text style={styles.doneTitle}>Submitted</Text><Text style={styles.muted}>This response is final and visible to your Gagan team.</Text>{existing.answers.map((answer: any) => <View key={answer.questionId} style={styles.answerSummary}><Text style={styles.question}>{answer.prompt}</Text><Text style={styles.muted}>{answer.value ?? answer.options.map((option: any) => option.label).join(", ")}</Text></View>)}</View> : <>{survey.questions.map((question: any, index: number) => <View key={question.id} style={styles.questionBox}><Text style={styles.question}>{index + 1}. {question.prompt}{question.required ? <Text style={styles.required}> *</Text> : null}</Text>{question.type === "single_choice" || question.type === "multiple_choice" ? <View style={styles.options}>{question.options.map((option: any) => { const current = answers[question.id]?.optionIds ?? []; const active = current.includes(option.id); return <Pressable key={option.id} style={[styles.option, active && styles.optionActive]} onPress={() => setAnswer(question.id, { optionIds: question.type === "single_choice" ? [option.id] : active ? current.filter((id) => id !== option.id) : [...current, option.id] })}><Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text></Pressable>; })}</View> : null}{question.type === "yes_no" ? <View style={styles.options}>{[true, false].map((value) => { const active = answers[question.id]?.value === value; return <Pressable key={String(value)} style={[styles.option, active && styles.optionActive]} onPress={() => setAnswer(question.id, { value })}><Text style={[styles.optionText, active && styles.optionTextActive]}>{value ? "Yes" : "No"}</Text></Pressable>; })}</View> : null}{question.type === "rating" ? <View style={styles.options}>{(() => { const min = Math.max(0, Math.ceil(Number(question.minValue ?? 1))); const max = Math.floor(Number(question.maxValue ?? 5)); return Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => min + i); })().map((value) => { const active = answers[question.id]?.value === value; return <Pressable key={value} style={[styles.rating, active && styles.ratingActive]} onPress={() => setAnswer(question.id, { value })}><Text style={[styles.ratingText, active && styles.ratingTextActive]}>{value}</Text></Pressable>; })}</View> : null}{question.type === "number" ? <TextInput style={styles.input} keyboardType="decimal-pad" value={answers[question.id]?.value == null ? "" : String(answers[question.id]?.value)} onChangeText={(value) => setAnswer(question.id, { value: value === "" ? null : Number(value) })} placeholder="Enter a number" placeholderTextColor={colors.inkFaint} /> : null}{question.type === "text" ? <TextInput style={[styles.input, styles.multiline]} multiline value={typeof answers[question.id]?.value === "string" ? answers[question.id]?.value as string : ""} onChangeText={(value) => setAnswer(question.id, { value })} placeholder="Write a short answer" placeholderTextColor={colors.inkFaint} /> : null}</View>)}<Pressable style={[styles.submit, submitting && styles.submitDisabled]} disabled={submitting} onPress={() => void submit()}><Text style={styles.submitText}>{submitting ? "Submitting…" : "Review and submit"}</Text><Ionicons name="checkmark-circle-outline" size={19} color={colors.onDark} /></Pressable></>}</ScrollView></KeyboardAvoidingView></View>;
  }

  return <View style={[styles.flex, { backgroundColor: colors.bg }]}><ScrollView contentContainerStyle={styles.content}><ScreenHeader title="Market surveys" subtitle="Short questions from your Gagan team" /><View style={styles.filterRow}><Pressable style={[styles.filter, filter === "available" && styles.filterActive]} onPress={() => setFilter("available")}><Text style={[styles.filterText, filter === "available" && styles.filterTextActive]}>Available</Text></Pressable><Pressable style={[styles.filter, filter === "submitted" && styles.filterActive]} onPress={() => setFilter("submitted")}><Text style={[styles.filterText, filter === "submitted" && styles.filterTextActive]}>Submitted</Text></Pressable></View>{loading ? <Text style={styles.muted}>Loading surveys…</Text> : visible.length === 0 ? <EmptyState title={filter === "available" ? "Nothing to answer" : "No submitted surveys"} body="Your active market surveys will appear here." /> : visible.map((survey) => <Pressable key={survey.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.8 }]} onPress={() => void open(survey)}><View style={styles.listIcon}><Ionicons name="clipboard-outline" size={20} color={colors.green} /></View><View style={styles.listCopy}><Text style={styles.listTitle}>{survey.title}</Text><Text style={styles.muted}>{survey.questions.length} question{survey.questions.length === 1 ? "" : "s"}{survey.submittedAt ? ` · ${new Date(survey.submittedAt).toLocaleDateString("en-IN")}` : ""}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.inkFaint} /></Pressable>)}</ScrollView></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 36, gap: spacing.md },
  back: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginHorizontal: spacing.lg, minHeight: 40 },
  backText: { color: colors.green, fontWeight: "700" },
  subtitle: { color: colors.inkMuted, fontSize: 14, lineHeight: 20, marginHorizontal: spacing.lg },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg, marginVertical: spacing.sm },
  filter: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  filterText: { color: colors.inkMuted, fontWeight: "700" },
  filterTextActive: { color: colors.onDark },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 70 },
  listIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  listCopy: { flex: 1, gap: 3 },
  listTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  muted: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  questionBox: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  question: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  required: { color: colors.danger },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  option: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  optionActive: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  optionText: { color: colors.inkMuted, fontWeight: "600" },
  optionTextActive: { color: colors.greenDeep },
  rating: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  ratingActive: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  ratingText: { color: colors.inkMuted, fontWeight: "700" },
  ratingTextActive: { color: colors.onDark },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, backgroundColor: colors.bg, fontSize: 15, marginTop: spacing.sm },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  submit: { marginHorizontal: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.greenDeep, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.onDark, fontSize: 15, fontWeight: "700" },
  done: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  doneTitle: { color: colors.greenDeep, fontSize: 16, fontWeight: "700" },
  answerSummary: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
});
