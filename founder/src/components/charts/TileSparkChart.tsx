import React from "react";
import { View, StyleSheet } from "react-native";
import type { TileSpark } from "../../pulse/types";
import { AreaChart } from "./AreaChart";
import { ColumnCompare } from "./ColumnCompare";
import { HeatStrip } from "./HeatStrip";
import { HorzCompareBars } from "./HorzCompareBars";

export function TileSparkChart({
  spark,
  width,
  height,
}: {
  spark: TileSpark;
  width: number;
  height: number;
}) {
  if (width <= 0) return <View style={{ height }} />;
  if (spark.kind === "area") return <AreaChart series={spark.series} width={width} height={height} />;
  if (spark.kind === "heat") return <HeatStrip cells={spark.cells} width={width} height={Math.min(height, 14)} color={spark.color} />;
  if (spark.kind === "columns") return <ColumnCompare columns={spark.columns} width={width} height={height} color={spark.color} />;
  return <HorzCompareBars bar={spark.bar} width={width} color={spark.color} />;
}

export const sparkStyles = StyleSheet.create({
  slot: { marginTop: 8, minHeight: 28 },
});
