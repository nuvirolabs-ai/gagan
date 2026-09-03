import React, { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import type { AreaSeries } from "../../pulse/types";

function plot(values: number[], width: number, height: number, padY = 4) {
  if (values.length === 0) return { line: "", area: "", xs: [] as number[], ys: [] as number[] };
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  const xs: number[] = [];
  const ys: number[] = [];
  values.forEach((v, i) => {
    xs.push(i * step);
    ys.push(padY + (1 - (v - min) / span) * (height - padY * 2));
  });
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)} ${height} L0 ${height} Z`;
  return { line, area, xs, ys };
}

export function AreaChart({
  series,
  width,
  height,
  showAxis = false,
}: {
  series: AreaSeries;
  width: number;
  height: number;
  showAxis?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const axisW = showAxis ? 36 : 0;
  const axisH = showAxis ? 14 : 0;
  const plotW = Math.max(1, width - axisW);
  const plotH = Math.max(1, height - axisH);
  const values = series.points.map((p) => p.v);
  const { line, area } = plot(values, plotW, plotH);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`ag-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={series.color} stopOpacity={0.38} />
          <Stop offset="1" stopColor={series.color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#ag-${id})`} transform={showAxis ? `translate(${axisW},0)` : undefined} />
      <Path
        d={line}
        fill="none"
        stroke={series.color}
        strokeWidth={1.4}
        transform={showAxis ? `translate(${axisW},0)` : undefined}
      />
      {showAxis && series.maxLabel ? (
        <SvgText x={axisW - 4} y={10} fill="#8B93A7" fontSize={8} textAnchor="end">
          {series.maxLabel}
        </SvgText>
      ) : null}
      {showAxis && series.minLabel ? (
        <SvgText x={axisW - 4} y={plotH - 2} fill="#8B93A7" fontSize={8} textAnchor="end">
          {series.minLabel}
        </SvgText>
      ) : null}
      {showAxis
        ? series.xLabels.map((label, i) => {
            const x = axisW + (i / 2) * plotW;
            const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
            return (
              <SvgText key={label} x={x} y={height - 1} fill="#8B93A7" fontSize={8} textAnchor={anchor}>
                {label}
              </SvgText>
            );
          })
        : null}
    </Svg>
  );
}
