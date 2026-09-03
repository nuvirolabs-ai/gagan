import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFounder } from "../context/FounderContext";
import { colors, radius, spacing, type as typeScale } from "../theme";
import { PulseHeader } from "../components/PulseHeader";
import { Caps, Panel } from "../components/ui";

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { staff, logout, dataSource, apiBaseUrl, today } = useFounder();

  const confirmLogout = () =>
    Alert.alert("Sign out", "Leave the Founders pulse?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32, paddingHorizontal: spacing.lg, gap: spacing.md }}>
      <PulseHeader brand="Gagan · Founders" title="You" rightTop={today?.hub} rightBottom="Settings" />

      <Panel>
        <Caps>Session</Caps>
        <Text style={[typeScale.kpiSm, { marginTop: 8 }]}>{staff?.name ?? "—"}</Text>
        <Text style={typeScale.meta}>{staff?.phone}</Text>
        {staff?.email ? <Text style={typeScale.meta}>{staff.email}</Text> : null}
      </Panel>

      <Panel>
        <Caps>Pulse data</Caps>
        <Row label="Source" value={dataSource === "live" ? "GET /founder/pulse" : "Local fixture"} />
        <Row label="API" value={apiBaseUrl} />
        <Text style={styles.note}>
          CEO KPI aggregates are not on the backend yet. The board maps a typed fixture (same shape as the future
          /founder/pulse payload). Staff login still uses /rep/auth.
        </Text>
      </Panel>

      <TouchableOpacity style={styles.out} onPress={confirmLogout} accessibilityRole="button">
        <Text style={styles.outText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={typeScale.meta}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowVal: { ...typeScale.meta, color: colors.ink, flex: 1, textAlign: "right" },
  note: { ...typeScale.micro, marginTop: spacing.md, lineHeight: 16 },
  out: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  outText: { color: colors.bad, fontWeight: "700" },
});
