import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors, type as typeScale } from "../../theme";
import type { HorzBar } from "../../pulse/types";

export function HorzCompareBars({
  bar,
  width,
  color,
}: {
  bar: HorzBar;
  width: number;
  color: string;
}) {
  const max = Math.max(bar.current, bar.prior, 1);
  const rowH = 8;
  const track = Math.max(40, width - 36);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.lab}>cur</Text>
        <Svg width={track} height={rowH}>
          <Rect x={0} y={0} width={track} height={rowH} rx={2} fill={colors.ghost} />
          <Rect x={0} y={0} width={Math.max(2, (bar.current / max) * track)} height={rowH} rx={2} fill={color} />
        </Svg>
      </View>
      <View style={styles.row}>
        <Text style={styles.lab}>pri</Text>
        <Svg width={track} height={rowH}>
          <Rect x={0} y={0} width={track} height={rowH} rx={2} fill={colors.ghost} />
          <Rect
            x={0}
            y={0}
            width={Math.max(2, (bar.prior / max) * track)}
            height={rowH}
            rx={2}
            fill="#3A414C"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  lab: { ...typeScale.micro, width: 22, color: colors.muted },
});
