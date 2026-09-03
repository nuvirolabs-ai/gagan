import React from "react";
import Svg, { Rect } from "react-native-svg";
import type { HeatCell } from "../../pulse/types";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function HeatStrip({
  cells,
  width,
  height,
  color,
}: {
  cells: HeatCell[];
  width: number;
  height: number;
  color: string;
}) {
  const n = Math.max(cells.length, 1);
  const gap = 2;
  const cellW = Math.max(2, (width - gap * (n - 1)) / n);
  const [r, g, b] = hexToRgb(color);

  return (
    <Svg width={width} height={height}>
      {cells.map((cell, i) => {
        const t = 0.18 + cell.v * 0.82;
        return (
          <Rect
            key={i}
            x={i * (cellW + gap)}
            y={0}
            width={cellW}
            height={height}
            rx={2}
            fill={`rgba(${r},${g},${b},${t.toFixed(2)})`}
          />
        );
      })}
    </Svg>
  );
}
