import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderDecision } from "../api/types";
import { usePreferences } from "../context/PreferencesContext";
import { formatInrExecutive } from "../format/inr";
import { friendlyError } from "../pulse/viewState";
import { SCREEN_PAD_TOP } from "../theme";

export default function DecisionDetailScreen({ route, navigation }: any) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const [decision, setDecision] = useState<FounderDecision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDecision(await founderApi.decision(route.params.id));
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }, [route.params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(kind: "approve" | "decline") {
    if (!decision) return;
    setBusy(true);
    try {
      const next =
        kind === "approve"
          ? await founderApi.approve(decision.id, reason || undefined)
          : await founderApi.decline(decision.id, reason || "Declined by founder.");
      setDecision(next);
    } catch (caught) {
      const message = friendlyError(caught);
      if (Platform.OS === "web") {
        window.alert(`Decision not recorded\n${message}`);
      } else {
        Alert.alert("Decision not recorded", message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SCREEN_PAD_TOP, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.info }]}>Decisions</Text>
        </Pressable>
        {error ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        {decision ? (
          <>
            <Text style={[styles.title, { color: colors.label }]}>{decision.title}</Text>
            <Text style={[styles.value, { color: colors.label }]}>
              {decision.amount != null ? formatInrExecutive(decision.amount) : ""}
            </Text>
            <Text style={[styles.section, { color: colors.secondary }]}>CONTEXT</Text>
            {decision.context.map((line) => (
              <Text key={line} style={[styles.body, { color: colors.label, marginBottom: 6 }]}>
                {line}
              </Text>
            ))}
            <Text style={[styles.section, { color: colors.secondary }]}>RECOMMENDATION</Text>
            <Text style={[styles.body, { color: colors.label }]}>
              {decision.recommendation} · {decision.recommendedBy}
            </Text>
            <Text style={[styles.meta, { color: colors.secondary }]}>{decision.recommendationReason}</Text>
            <Text style={[styles.section, { color: colors.secondary }]}>OWNER</Text>
            <Text style={[styles.body, { color: colors.label }]}>
              {decision.owner} · requested by {decision.requester}
            </Text>
            {decision.availableActions.length > 0 ? (
              <>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Note (required to decline)"
                  placeholderTextColor={colors.tertiary}
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.label, borderColor: colors.separator }]}
                />
                <View style={styles.actions}>
                  {decision.availableActions.includes("approve") ? (
                    <Pressable disabled={busy} onPress={() => void act("approve")} style={[styles.button, { backgroundColor: colors.label }]}>
                      <Text style={[styles.buttonLabel, { color: colors.canvas }]}>Approve</Text>
                    </Pressable>
                  ) : null}
                  {decision.availableActions.includes("decline") ? (
                    <Pressable disabled={busy} onPress={() => void act("decline")} style={[styles.button, { backgroundColor: colors.fill }]}>
                      <Text style={[styles.buttonLabel, { color: colors.label }]}>Decline</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : (
              <Text style={[styles.meta, { color: colors.secondary, marginTop: 24 }]}>
                {decision.status === "open" ? "This account can view the decision but cannot decide." : `Closed · ${decision.status}`}
              </Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { fontSize: 17, marginBottom: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  value: { fontSize: 28, fontWeight: "600", marginTop: 10, fontVariant: ["tabular-nums"] },
  section: { marginTop: 28, marginBottom: 8, fontSize: 13, fontWeight: "600", letterSpacing: 1.2 },
  body: { fontSize: 17, lineHeight: 24 },
  meta: { fontSize: 15, lineHeight: 20, marginTop: 6 },
  input: { marginTop: 28, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonLabel: { fontSize: 17, fontWeight: "600" },
});
