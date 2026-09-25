import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Tokens } from "../theme";

function shortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Sparkline({
  points,
  colors,
  positive,
  formatValue,
}: {
  points: Array<{ date?: string; value: number | null }>;
  colors: Tokens;
  positive?: boolean;
  formatValue?: (value: number) => string;
}) {
  const values = points.map((point) => point.value).filter((value): value is number => value != null);
  if (values.length < 2) {
    return <View style={{ height: 88 }} />;
  }
  const width = 320;
  const height = 72;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const d = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const format = formatValue ?? ((value: number) => String(Math.round(value)));
  const firstDate = points.find((point) => point.date)?.date;
  const lastDate = [...points].reverse().find((point) => point.date)?.date;
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.yAxis}>
          <Text style={[styles.axis, { color: colors.tertiary }]} numberOfLines={1}>
            {format(max)}
          </Text>
          <Text style={[styles.axis, { color: colors.tertiary }]} numberOfLines={1}>
            {format(min)}
          </Text>
        </View>
        <View style={styles.chart}>
          <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <Path d={d} fill="none" stroke={positive === false ? colors.negative : colors.label} strokeWidth={1.5} />
          </Svg>
        </View>
      </View>
      {firstDate && lastDate ? (
        <View style={styles.xAxis}>
          <Text style={[styles.axis, { color: colors.tertiary }]}>{shortDate(firstDate)}</Text>
          <Text style={[styles.axis, { color: colors.tertiary }]}>{shortDate(lastDate)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  yAxis: { width: 52, height: 72, justifyContent: "space-between" },
  chart: { flex: 1 },
  xAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingLeft: 60 },
  axis: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
