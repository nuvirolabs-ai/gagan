import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { colors, radius, spacing, type as typeScale, toneColor } from "../theme";
import type { VsPriorChip } from "../pulse/types";
import { Caps } from "./ui";
import { TileSparkChart } from "./charts/TileSparkChart";

export function VsPriorStrip({ title, chips }: { title: string; chips: VsPriorChip[] }) {
  return (
    <View>
      <Caps style={styles.title}>{title}</Caps>
      <View style={styles.row}>
        {chips.map((chip) => (
          <VsChip key={chip.id} chip={chip} />
        ))}
      </View>
    </View>
  );
}

function VsChip({ chip }: { chip: VsPriorChip }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <View style={styles.chip}>
      <Text style={styles.name}>{chip.name}</Text>
      <Text style={[styles.delta, { color: toneColor(chip.delta.tone) }]}>{chip.delta.label}</Text>
      <View onLayout={onLayout} style={styles.spark}>
        <TileSparkChart spark={chip.spark} width={width} height={18} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  name: { ...typeScale.micro, marginBottom: 2 },
  delta: { fontSize: 11, fontWeight: "800" },
  spark: { marginTop: 6, height: 18 },
});
