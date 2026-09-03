import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, type as typeScale } from "../theme";
import type { HealthTone } from "../pulse/types";

const DOT: Record<HealthTone, string> = {
  ok: colors.up,
  amber: colors.warn,
  crit: colors.bad,
};

export function HealthStrip({
  tone,
  label,
  detail,
  trailing,
}: {
  tone: HealthTone;
  label: string;
  detail: string;
  trailing?: string;
}) {
  return (
    <View style={styles.strip}>
      <View style={[styles.dot, { backgroundColor: DOT[tone] }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.detail} numberOfLines={1}>
        {detail}
      </Text>
      {trailing ? (
        <Text style={styles.trailing} numberOfLines={1}>
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panelAlt,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...typeScale.body, fontWeight: "700", color: colors.ink },
  detail: { ...typeScale.meta, flex: 1 },
  trailing: { ...typeScale.meta, marginLeft: 8 },
});
