import React from "react";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../../theme";
import { compactInr } from "../../pulse/format";
import type { ColumnPoint } from "../../pulse/types";

export function ColumnCompare({
  columns,
  width,
  height,
  color = colors.up,
  showAxis = false,
  xLabels,
}: {
  columns: ColumnPoint[];
  width: number;
  height: number;
  color?: string;
  showAxis?: boolean;
  xLabels?: [string, string, string];
}) {
  const axisH = showAxis ? 14 : 0;
  const plotH = Math.max(1, height - axisH);
  const n = Math.max(columns.length, 1);
  const slot = width / n;
  const ghostW = Math.min(10, slot * 0.42);
  const curW = Math.min(7, slot * 0.3);
  const max = Math.max(1, ...columns.flatMap((c) => [c.current, c.prior]));

  return (
    <Svg width={width} height={height}>
      {columns.map((col, i) => {
        const cx = slot * i + slot / 2;
        const gh = (col.prior / max) * (plotH - 2);
        const ch = (col.current / max) * (plotH - 2);
        return (
          <React.Fragment key={i}>
            <Rect x={cx - ghostW / 2} y={plotH - gh} width={ghostW} height={Math.max(1, gh)} fill={colors.ghost} rx={1.5} />
            <Rect x={cx - curW / 2} y={plotH - ch} width={curW} height={Math.max(1, ch)} fill={color} rx={1.5} />
          </React.Fragment>
        );
      })}
      {showAxis && columns.length > 0 ? (
        <SvgText
          x={width}
          y={Math.max(10, plotH - (columns[columns.length - 1].current / max) * (plotH - 2) - 2)}
          fill={colors.ink}
          fontSize={8}
          fontWeight="700"
          textAnchor="end"
        >
          {compactInr(columns[columns.length - 1].current)}
        </SvgText>
      ) : null}
      {showAxis && xLabels
        ? xLabels.map((label, i) => {
            const x = (i / 2) * width;
            const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
            return (
              <SvgText key={label} x={x} y={height - 1} fill={colors.muted} fontSize={8} textAnchor={anchor}>
                {label}
              </SvgText>
            );
          })
        : null}
    </Svg>
  );
}
