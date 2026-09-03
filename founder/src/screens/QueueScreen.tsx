import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type as typeScale } from "../theme";
import { PulseHeader } from "../components/PulseHeader";
import { Panel } from "../components/ui";

/** Queue chrome is not chairman-locked. Issues and Decisions keep their existing contracts. */
export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <PulseHeader brand="Gagan · Founders" title="Queue" />
      <Panel>
        <Text style={typeScale.title}>Coming soon</Text>
        <Text style={styles.body}>
          Queue presentation is pending chairman lock. Issues and Decisions keep their existing contracts.
        </Text>
      </Panel>
      <Pressable onPress={() => navigation.navigate("Issues")} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.bad }]}>ISSUES</Text>
          <Text style={styles.rowTitle}>Open constraints</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Decisions")} style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.accent }]}>DECISIONS</Text>
          <Text style={styles.rowTitle}>Approve or decline</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, gap: spacing.md },
  body: { ...typeScale.meta, marginTop: spacing.md, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  rowTitle: { fontSize: 16, fontWeight: "700", marginTop: 4, color: colors.ink },
});
