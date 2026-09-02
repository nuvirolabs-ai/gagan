import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Tokens } from "../theme";

export default function Sparkline({
  points,
  colors,
  positive,
}: {
  points: Array<{ value: number | null }>;
  colors: Tokens;
  positive?: boolean;
}) {
  const values = points.map((point) => point.value).filter((value): value is number => value != null);
  if (values.length < 2) {
    return <View style={{ height: 72 }} />;
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
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={d} fill="none" stroke={positive === false ? colors.negative : colors.label} strokeWidth={1.5} />
    </Svg>
  );
}
