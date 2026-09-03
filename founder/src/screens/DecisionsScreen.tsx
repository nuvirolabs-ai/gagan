import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderDecision, FounderDecisions } from "../api/types";
import Segmented from "../components/Segmented";
import { usePreferences } from "../context/PreferencesContext";
import { formatAge, formatDue } from "../format/age";
import { formatInrExecutive } from "../format/inr";
import { friendlyError } from "../pulse/viewState";

export default function DecisionsScreen() {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [segment, setSegment] = useState<"open" | "history">("open");
  const [payload, setPayload] = useState<FounderDecisions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPayload(await founderApi.decisions(segment));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const decisions = payload?.decisions ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading && !!payload} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        <Text style={[styles.kicker, { color: colors.secondary }]}>DECISIONS</Text>
        <Text style={[styles.title, { color: colors.label }]}>Decisions</Text>
        <View style={{ marginTop: 16 }}>
          <Segmented
            value={segment}
            options={[
              { id: "open", label: "Open" },
              { id: "history", label: "History" },
            ]}
            onChange={setSegment}
            colors={colors}
          />
        </View>
        {error ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        {segment === "open" && decisions.length === 0 && !loading ? (
          <View style={{ marginTop: 36 }}>
            <Text style={[styles.emptyTitle, { color: colors.label }]}>Nothing needs your decision.</Text>
            <Text style={[styles.body, { color: colors.secondary, marginTop: 8 }]}>
              Operations are within delegated authority.
            </Text>
          </View>
        ) : (
          <View style={[styles.group, { backgroundColor: colors.surface, marginTop: 20 }]}>
            {decisions.map((decision, index) => (
              <Pressable
                key={decision.id}
                onPress={() => navigation.navigate("DecisionDetail", { id: decision.id })}
                style={[styles.row, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.label }]}>{decision.title}</Text>
                  <Text style={[styles.amount, { color: colors.label }]}>
                    {decision.amount != null ? formatInrExecutive(decision.amount) : ""}
                  </Text>
                  <Text style={[styles.meta, { color: colors.secondary }]}>
                    {[decision.requester, decision.owner, ageLine(decision)].filter(Boolean).join(" · ")}
                  </Text>
                  <Text style={[styles.meta, { color: colors.secondary }]}>
                    {decision.status === "open" ? decision.recommendation : decision.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
              </Pressable>
            ))}
          </View>
        )}
        {payload?.unavailableTypes.length ? (
          <Text style={[styles.footnote, { color: colors.tertiary }]}>
            Large purchases and exceptional discounts are not in Gagan V1.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ageLine(decision: FounderDecision): string {
  if (decision.dueAt) return formatDue(decision.dueAt);
  const hours = Math.max(0, Math.round((Date.now() - new Date(decision.createdAt).getTime()) / 3_600_000));
  return formatAge(hours);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 1.6, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  group: { borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  amount: { fontSize: 17, marginTop: 4, fontVariant: ["tabular-nums"] },
  meta: { fontSize: 13, marginTop: 4 },
  body: { fontSize: 17, lineHeight: 24 },
  emptyTitle: { fontSize: 22, fontWeight: "600" },
  footnote: { fontSize: 13, marginTop: 20, lineHeight: 18 },
});
