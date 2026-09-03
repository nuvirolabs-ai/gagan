import React from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { Tokens } from "../theme";

export type SparkVariant = "line" | "area" | "columns" | "heat";

export default function Sparkline({
  points,
  colors,
  positive,
  variant = "line",
  height = 72,
}: {
  points: Array<{ value: number | null }>;
  colors: Tokens;
  positive?: boolean;
  variant?: SparkVariant;
  height?: number;
}) {
  const values = points.map((point) => point.value).filter((value): value is number => value != null);
  if (values.length < 2) {
    return <View style={{ height }} />;
  }
  const width = 320;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stroke = positive === false ? colors.negative : colors.positive;
  const step = width / (values.length - 1);
  const coords = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return { x, y, value };
  });
  const line = coords.map((c, index) => `${index === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)} ${height} L0 ${height} Z`;

  if (variant === "columns") {
    const slot = width / values.length;
    const barW = Math.max(3, slot * 0.42);
    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {values.map((value, index) => {
          const h = ((value - min) / span) * (height - 6) + 4;
          return (
            <Rect
              key={index}
              x={index * slot + (slot - barW) / 2}
              y={height - h}
              width={barW}
              height={h}
              rx={1.5}
              fill={stroke}
            />
          );
        })}
      </Svg>
    );
  }

  if (variant === "heat") {
    const n = values.length;
    const gap = 3;
    const cellW = Math.max(4, (width - gap * (n - 1)) / n);
    return (
      <Svg width="100%" height={Math.min(height, 16)} viewBox={`0 0 ${width} 16`}>
        {values.map((value, index) => {
          const t = 0.2 + ((value - min) / span) * 0.8;
          return (
            <Rect
              key={index}
              x={index * (cellW + gap)}
              y={2}
              width={cellW}
              height={12}
              rx={2}
              fill={colors.accent}
              opacity={t}
            />
          );
        })}
      </Svg>
    );
  }

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {variant === "area" ? <Path d={area} fill={stroke} opacity={0.22} /> : null}
      <Path d={line} fill="none" stroke={variant === "area" ? stroke : positive === false ? colors.negative : colors.label} strokeWidth={1.5} />
    </Svg>
  );
}
