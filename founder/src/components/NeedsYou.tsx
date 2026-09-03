import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, type as typeScale } from "../theme";
import type { NeedItem } from "../pulse/types";
import { Caps, Panel } from "./ui";

export function NeedsYou({ items }: { items: NeedItem[] }) {
  if (items.length === 0) return null;
  return (
    <Panel>
      <Caps style={styles.title}>Needs you</Caps>
      {items.map((item) => (
        <View key={item.title} style={styles.row}>
          <View style={[styles.tag, item.kind === "crit" ? styles.crit : styles.decide]}>
            <Text style={[styles.tagText, item.kind === "crit" ? { color: colors.bad } : { color: colors.accent }]}>
              {item.kind === "crit" ? "CRIT" : "DECIDE"}
            </Text>
          </View>
          <View style={styles.mid}>
            <Text style={styles.titleText}>{item.title}</Text>
            <Text style={typeScale.micro}>{item.meta}</Text>
          </View>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  tag: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  decide: { backgroundColor: "rgba(122, 162, 255, 0.14)" },
  crit: { backgroundColor: "rgba(255, 107, 107, 0.14)" },
  tagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  mid: { flex: 1 },
  titleText: { ...typeScale.body, fontWeight: "700" },
  value: { ...typeScale.body, fontWeight: "700" },
});
