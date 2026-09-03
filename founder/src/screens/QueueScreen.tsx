import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreferences } from "../context/PreferencesContext";

/**
 * Queue hub — Issues and Decisions stay wired; chairman Queue UI is not locked yet.
 */
export default function QueueScreen() {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas, paddingTop: insets.top + 8, paddingHorizontal: 16 }]}>
      <Text style={[styles.brand, { color: colors.secondary }]}>GAGAN · FOUNDERS</Text>
      <Text style={[styles.title, { color: colors.label }]}>Queue</Text>
      <Text style={[styles.note, { color: colors.secondary }]}>
        Queue presentation is pending chairman lock. Issues and Decisions keep their existing contracts.
      </Text>

      <Pressable
        onPress={() => navigation.navigate("Issues")}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.separator }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.negative }]}>ISSUES</Text>
          <Text style={[styles.rowTitle, { color: colors.label }]}>Open constraints</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("Decisions")}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.separator }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.info }]}>DECISIONS</Text>
          <Text style={[styles.rowTitle, { color: colors.label }]}>Approve or decline</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brand: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -0.6, marginTop: 4 },
  note: { fontSize: 13, lineHeight: 18, marginTop: 10, marginBottom: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  rowTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
});
