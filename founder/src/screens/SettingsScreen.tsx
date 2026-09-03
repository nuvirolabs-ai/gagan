import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Segmented from "../components/Segmented";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import type { TrendPeriod } from "../api/types";
import type { AppearancePref } from "../settings/preferences";

export default function SettingsScreen({ navigation }: { navigation: { goBack: () => void; canGoBack?: () => boolean } }) {
  const { colors, preferences, setDefaultPeriod, setAppearance } = usePreferences();
  const { identity, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        {navigation.canGoBack?.() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={[styles.back, { color: colors.info }]}>Close</Text>
          </Pressable>
        ) : (
          <Text style={[styles.brand, { color: colors.secondary }]}>GAGAN · FOUNDERS</Text>
        )}
        <Text style={[styles.title, { color: colors.label }]}>{navigation.canGoBack?.() ? "Settings" : "You"}</Text>

        <Text style={[styles.section, { color: colors.secondary }]}>PROFILE</Text>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <Row label="Name" value={identity?.name ?? "Founder"} colors={colors} first />
          <Row label="Role" value="Founder" colors={colors} />
        </View>

        <Text style={[styles.section, { color: colors.secondary }]}>PREFERENCES</Text>
        <View style={[styles.group, { backgroundColor: colors.surface, padding: 12 }]}>
          <Text style={[styles.rowLabel, { color: colors.secondary, marginBottom: 8 }]}>Default period</Text>
          <Segmented
            value={preferences.defaultPeriod}
            options={[
              { id: "7D", label: "7D" },
              { id: "30D", label: "30D" },
              { id: "90D", label: "90D" },
            ]}
            onChange={(value) => setDefaultPeriod(value as TrendPeriod)}
            colors={colors}
          />
          <Text style={[styles.rowLabel, { color: colors.secondary, marginTop: 16, marginBottom: 8 }]}>Appearance</Text>
          <Segmented
            value={preferences.appearance}
            options={[
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ]}
            onChange={(value) => setAppearance(value as AppearancePref)}
            colors={colors}
          />
        </View>

        <Text style={[styles.section, { color: colors.secondary }]}>DATA</Text>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <Row label="Freshness" value="Live from canonical Gagan data" colors={colors} first />
          <Row label="Privacy" value="Founder reads only. No operational edits." colors={colors} />
        </View>

        <Text style={[styles.section, { color: colors.secondary }]}>SECURITY</Text>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <Pressable onPress={() => void signOut()} style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.negative }]}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: colors.secondary }]}>SUPPORT</Text>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <Pressable onPress={() => void Linking.openURL("mailto:founder@gagan.test")} style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.label }]}>Send feedback</Text>
          </Pressable>
          <View style={[styles.row, { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.rowTitle, { color: colors.label }]}>What's new</Text>
            <Text style={[styles.rowValue, { color: colors.secondary }]}>Founder V1</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  colors,
  first,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof usePreferences>["colors"];
  first?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        first ? null : { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[styles.rowTitle, { color: colors.label }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.secondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brand: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 8 },
  back: { fontSize: 17, marginBottom: 12 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  section: { marginTop: 28, marginBottom: 8, fontSize: 13, fontWeight: "600", letterSpacing: 1.2 },
  group: { borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  rowTitle: { fontSize: 17 },
  rowValue: { fontSize: 15, flexShrink: 1, textAlign: "right" },
  rowLabel: { fontSize: 13, fontWeight: "600" },
});
