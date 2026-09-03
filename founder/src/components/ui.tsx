import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
import { colors, radius, spacing, type as typeScale, toneColor, type Tone } from "../theme";
import type { DeltaView } from "../pulse/types";

export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Caps({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typeScale.caps, style]}>{children}</Text>;
}

export function DeltaText({ delta, compact }: { delta: DeltaView; compact?: boolean }) {
  return (
    <Text style={[compact ? styles.deltaSm : styles.delta, { color: toneColor(delta.tone as Tone) }]}>{delta.label}</Text>
  );
}

export function DeltaRow({ day, week, month }: { day: DeltaView; week: DeltaView; month: DeltaView }) {
  return (
    <View style={styles.deltaRow}>
      <DeltaText delta={day} compact />
      <DeltaText delta={week} compact />
      <DeltaText delta={month} compact />
    </View>
  );
}

export function Readout({ text }: { text: string }) {
  return (
    <View style={styles.readout}>
      <Text style={styles.readoutInk}>Readout · </Text>
      <Text style={styles.readoutMuted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  deltaRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  delta: { fontSize: 11, fontWeight: "700" },
  deltaSm: { fontSize: 10, fontWeight: "700" },
  readout: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  readoutInk: { ...typeScale.meta, color: colors.ink, fontWeight: "700" },
  readoutMuted: { ...typeScale.meta, flex: 1 },
});
