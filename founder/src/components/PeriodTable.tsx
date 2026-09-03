import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, type as typeScale, toneColor } from "../theme";
import type { PeriodRow } from "../pulse/types";
import { Caps, Panel } from "./ui";

export function PeriodTable({ title, rows }: { title: string; rows: PeriodRow[] }) {
  return (
    <Panel>
      <Caps style={styles.title}>{title}</Caps>
      <View style={styles.head}>
        <Text style={[styles.headCell, styles.metric]} />
        <Text style={styles.headCell}>Today</Text>
        <Text style={styles.headCell}>Week</Text>
        <Text style={styles.headCell}>Month</Text>
      </View>
      {rows.map((row, i) => (
        <View key={row.id} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
          <Text style={[styles.cell, styles.metric, { color: colors.ink }]}>{row.name}</Text>
          <Text style={[styles.cell, { color: toneColor(row.today.tone) }]}>{row.today.text}</Text>
          <Text style={[styles.cell, { color: toneColor(row.week.tone) }]}>{row.week.text}</Text>
          <Text style={[styles.cell, { color: toneColor(row.month.tone) }]}>{row.month.text}</Text>
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  head: { flexDirection: "row", marginBottom: 6 },
  headCell: { ...typeScale.micro, flex: 1, textAlign: "right" },
  metric: { flex: 1.15, textAlign: "left" },
  row: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  rowLast: { paddingBottom: 0 },
  cell: { ...typeScale.meta, flex: 1, textAlign: "right", fontWeight: "600", color: colors.ink },
});
