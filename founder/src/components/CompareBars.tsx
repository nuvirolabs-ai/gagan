import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { Tokens } from "../theme";

/** Presentation of current vs prior scalars already on the trend comparison. */
export default function CompareBars({
  current,
  previous,
  colors,
  color,
}: {
  current: number;
  previous: number;
  colors: Tokens;
  color?: string;
}) {
  const max = Math.max(current, previous, 1);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.lab, { color: colors.secondary }]}>cur</Text>
        <Svg width="100%" height={8} viewBox="0 0 120 8" preserveAspectRatio="none" style={{ flex: 1 }}>
          <Rect x={0} y={0} width={120} height={8} rx={2} fill={colors.separator} />
          <Rect x={0} y={0} width={Math.max(4, (current / max) * 120)} height={8} rx={2} fill={color ?? colors.positive} />
        </Svg>
      </View>
      <View style={styles.row}>
        <Text style={[styles.lab, { color: colors.secondary }]}>pri</Text>
        <Svg width="100%" height={8} viewBox="0 0 120 8" preserveAspectRatio="none" style={{ flex: 1 }}>
          <Rect x={0} y={0} width={120} height={8} rx={2} fill={colors.separator} />
          <Rect x={0} y={0} width={Math.max(4, (previous / max) * 120)} height={8} rx={2} fill={colors.fill} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  lab: { fontSize: 10, fontWeight: "600", width: 22 },
});
