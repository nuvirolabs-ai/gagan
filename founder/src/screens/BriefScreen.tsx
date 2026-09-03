import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderBrief } from "../api/types";
import Segmented from "../components/Segmented";
import { usePreferences } from "../context/PreferencesContext";
import { friendlyError } from "../pulse/viewState";

export default function BriefScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const hour = new Date().getHours();
  const [kind, setKind] = useState<"morning" | "evening">(hour < 17 ? "morning" : "evening");
  const [brief, setBrief] = useState<FounderBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBrief(await founderApi.brief(kind));
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={[styles.back, { color: colors.info }]}>Pulse</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.label }]}>{kind === "morning" ? "Morning brief" : "Evening brief"}</Text>
        <View style={{ marginTop: 16 }}>
          <Segmented
            value={kind}
            options={[
              { id: "morning", label: "Morning" },
              { id: "evening", label: "Evening" },
            ]}
            onChange={setKind}
            colors={colors}
          />
        </View>
        {error ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        <View style={{ marginTop: 28, gap: 18 }}>
          {brief?.statements.map((statement) => (
            <Text key={statement} style={[styles.statement, { color: colors.label }]}>
              {statement}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { fontSize: 17, marginBottom: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  body: { fontSize: 17, lineHeight: 24 },
  statement: { fontSize: 22, fontWeight: "600", lineHeight: 28 },
});
