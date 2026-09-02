import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderIssueDetail } from "../api/types";
import { usePreferences } from "../context/PreferencesContext";
import { formatAge } from "../format/age";
import { formatInrExecutive } from "../format/inr";
import { friendlyError } from "../pulse/viewState";
import { impactLabel } from "../format/impact";
import { SCREEN_PAD_TOP } from "../theme";

export default function IssueDetailScreen({ route, navigation }: any) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const [issue, setIssue] = useState<FounderIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIssue(await founderApi.issue(route.params.id));
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }, [route.params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + SCREEN_PAD_TOP, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.info }]}>Issues</Text>
        </Pressable>
        {error ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        {issue ? (
          <>
            <Text style={[styles.title, { color: colors.label }]}>{issue.title}</Text>
            <Text style={[styles.severity, { color: issue.severity === "WATCH" ? colors.warning : colors.negative }]}>
              {issue.severity === "WATCH" ? "Watch" : issue.severity === "HIGH" ? "High impact" : "Critical"}
            </Text>
            <Text style={[styles.value, { color: colors.label }]}>{impactLabel(issue)}</Text>
            <Text style={[styles.section, { color: colors.secondary }]}>WHAT HAPPENED</Text>
            <Text style={[styles.body, { color: colors.label }]}>{issue.explanation}</Text>
            <Text style={[styles.section, { color: colors.secondary }]}>OWNER</Text>
            <Text style={[styles.body, { color: colors.label }]}>{issue.owner}</Text>
            <Text style={[styles.section, { color: colors.secondary }]}>AGE</Text>
            <Text style={[styles.body, { color: colors.label }]}>{formatAge(issue.ageHours) || "Opened with the current constraint."}</Text>
            <Text style={[styles.section, { color: colors.secondary }]}>EXPECTED NEXT</Text>
            <Text style={[styles.body, { color: colors.label }]}>{issue.expectedNext ?? "Until the underlying constraint clears."}</Text>
            {issue.affected.orders.length > 0 ? (
              <>
                <Text style={[styles.section, { color: colors.secondary }]}>AFFECTED ORDERS</Text>
                <View style={[styles.group, { backgroundColor: colors.surface }]}>
                  {issue.affected.orders.map((order, index) => (
                    <View
                      key={order.id}
                      style={[styles.row, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.label }]}>{order.ref}</Text>
                        <Text style={[styles.meta, { color: colors.secondary }]}>{order.retailerName}</Text>
                      </View>
                      <Text style={[styles.rowTitle, { color: colors.label }]}>{formatInrExecutive(order.total)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {issue.affected.retailers.length > 0 ? (
              <>
                <Text style={[styles.section, { color: colors.secondary }]}>AFFECTED RETAILERS</Text>
                <Text style={[styles.body, { color: colors.label }]}>
                  {issue.affected.retailers.map((row) => row.name).join(", ")}
                </Text>
              </>
            ) : null}
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
  severity: { fontSize: 15, fontWeight: "600", marginTop: 10 },
  value: { fontSize: 28, fontWeight: "600", marginTop: 8, fontVariant: ["tabular-nums"] },
  section: { marginTop: 28, marginBottom: 8, fontSize: 13, fontWeight: "600", letterSpacing: 1.2 },
  body: { fontSize: 17, lineHeight: 24 },
  group: { borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  meta: { fontSize: 13, marginTop: 2 },
});
