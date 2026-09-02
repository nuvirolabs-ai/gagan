import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderIssue } from "../api/types";
import Segmented from "../components/Segmented";
import { usePreferences } from "../context/PreferencesContext";
import { formatAge } from "../format/age";
import { impactLabel } from "../format/impact";
import { friendlyError } from "../pulse/viewState";
import { SCREEN_PAD_TOP } from "../theme";

export default function IssuesScreen() {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [issues, setIssues] = useState<FounderIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = filter === "all" ? "open" : filter;
      const body = await founderApi.issues(status);
      setIssues(filter === "resolved" ? [] : body.issues);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + SCREEN_PAD_TOP, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading && issues.length > 0} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        <Text style={[styles.kicker, { color: colors.secondary }]}>ISSUES</Text>
        <Text style={[styles.title, { color: colors.label }]}>Issues</Text>
        <View style={{ marginTop: 16 }}>
          <Segmented
            value={filter}
            options={[
              { id: "all", label: "All" },
              { id: "open", label: "Open" },
              { id: "resolved", label: "Resolved" },
            ]}
            onChange={setFilter}
            colors={colors}
          />
        </View>
        {error ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        {filter === "resolved" ? (
          <Text style={[styles.empty, { color: colors.secondary }]}>
            Issues exist only while the constraint is open.
          </Text>
        ) : (
          <View style={[styles.group, { backgroundColor: colors.surface, marginTop: 20 }]}>
            {issues.length === 0 && !loading ? (
              <Text style={[styles.body, { color: colors.secondary }]}>No open executive issues.</Text>
            ) : (
              issues.map((issue, index) => (
                <Pressable
                  key={issue.id}
                  onPress={() => navigation.navigate("IssueDetail", { id: issue.id })}
                  style={[styles.row, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.severity, { color: issue.severity === "WATCH" ? colors.warning : colors.negative }]}>
                      {issue.severity}
                    </Text>
                    <Text style={[styles.rowTitle, { color: colors.label }]}>{issue.title}</Text>
                    <Text style={[styles.impact, { color: colors.label }]}>{impactLabel(issue)}</Text>
                    <Text style={[styles.meta, { color: colors.secondary }]}>
                      {[issue.owner, formatAge(issue.ageHours)].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 1.6, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  group: { borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  severity: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  rowTitle: { fontSize: 17, fontWeight: "600", marginTop: 4 },
  impact: { fontSize: 17, marginTop: 4, fontVariant: ["tabular-nums"] },
  meta: { fontSize: 13, marginTop: 4 },
  body: { fontSize: 17, lineHeight: 24 },
  empty: { fontSize: 17, lineHeight: 24, marginTop: 28 },
});
