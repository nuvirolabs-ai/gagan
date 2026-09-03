import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radius, type as typeScale } from "../theme";
import type { SeriesPeriod } from "../pulse/types";

const OPTIONS: { id: SeriesPeriod; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function PeriodChips({
  value,
  onChange,
}: {
  value: SeriesPeriod;
  onChange: (next: SeriesPeriod) => void;
}) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const on = opt.id === value;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  label: { ...typeScale.micro, color: colors.muted, fontWeight: "700" },
  labelOn: { color: colors.bg, fontWeight: "800" },
});
