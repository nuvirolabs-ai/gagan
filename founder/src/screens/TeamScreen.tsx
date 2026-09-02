import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderTeam } from "../api/types";
import { usePreferences } from "../context/PreferencesContext";
import { formatInrExecutive } from "../format/inr";
import { friendlyError } from "../pulse/viewState";

export default function TeamScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const [team, setTeam] = useState<FounderTeam | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTeam(await founderApi.team());
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.info }]}>Pulse</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.label }]}>Sales team</Text>
        <Text style={[styles.meta, { color: colors.secondary }]}>{team?.period.label ?? ""}</Text>
        {error ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        <View style={[styles.group, { backgroundColor: colors.surface, marginTop: 20 }]}>
          {(team?.nodes ?? []).map((node, index) => (
            <View key={node.id}>
              <View style={[styles.row, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.label }]}>{node.name}</Text>
                  <Text style={[styles.meta, { color: colors.secondary }]}>{node.role}</Text>
                </View>
                <Text style={[styles.rowTitle, { color: colors.label }]}>{formatInrExecutive(node.orderValue)}</Text>
              </View>
              {node.children?.map((child) => (
                <View key={child.id} style={[styles.child, { borderTopColor: colors.separator }]}>
                  <Text style={[styles.body, { color: colors.label }]}>{child.name}</Text>
                  <Text style={[styles.meta, { color: colors.secondary }]}>{formatInrExecutive(child.orderValue)}</Text>
                </View>
              ))}
            </View>
          ))}
          {team && team.nodes.length === 0 ? (
            <Text style={[styles.body, { color: colors.secondary, padding: 16 }]}>
              No salesperson assignments are linked for today.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { fontSize: 17, marginBottom: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  group: { borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 },
  child: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 28, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 17 },
  meta: { fontSize: 13, marginTop: 2 },
});
