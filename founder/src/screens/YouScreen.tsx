import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useFounder } from "../context/FounderContext";
import { founderApi } from "../api/founder";
import { colors, radius, spacing, type as typeScale } from "../theme";
import { PulseHeader } from "../components/PulseHeader";
import { Caps, Panel } from "../components/ui";

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { identity, signOut } = useAuth();
  const { dataSource, stagingGaps, today } = useFounder();

  const confirmLogout = () =>
    Alert.alert("Sign out", "Leave the Founders pulse?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32, paddingHorizontal: spacing.lg, gap: spacing.md }}
    >
      <PulseHeader brand="Gagan · Founders" title="You" rightTop={today?.hub} rightBottom="Settings" />

      <Panel>
        <Caps>Session</Caps>
        <Text style={[typeScale.kpiSm, { marginTop: 8 }]}>{identity?.name ?? today?.viewerName ?? "—"}</Text>
        <Text style={typeScale.meta}>{identity?.phone}</Text>
      </Panel>

      <Panel>
        <Caps>Pulse data</Caps>
        <Row label="Source" value={dataSource === "live" ? "Mapped /founder/pulse + /founder/trends" : "Staging fixture"} />
        <Row label="API" value={founderApi.baseUrl} />
        <Row label="Staging gaps" value={stagingGaps.length ? stagingGaps.join(", ") : "none"} />
        <Text style={styles.note}>
          Today and Series are the locked Quiet Instrument CEO board (Present · Sales · Delivery · Payments ·
          Inventory). Orders/Collections/Fill/Blocked are mapped into those five KPIs. Present attendance, inventory
          stock value, hub and region use a clearly labeled staging fixture until those aggregates exist on the API.
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
