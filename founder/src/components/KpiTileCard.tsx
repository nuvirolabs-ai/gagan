import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import { colors, radius, spacing, type as typeScale } from "../theme";
import type { KpiTile } from "../pulse/types";
import { Caps, DeltaRow, Panel } from "./ui";
import { TileSparkChart } from "./charts/TileSparkChart";

export function KpiTileCard({ tile }: { tile: KpiTile }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Panel style={styles.card}>
      <Caps>{tile.title}</Caps>
      <Text style={typeScale.kpiSm}>{tile.value}</Text>
      <DeltaRow day={tile.day} week={tile.week} month={tile.month} />
      {tile.sub ? <Text style={styles.sub}>{tile.sub}</Text> : null}
      <View style={styles.spark} onLayout={onLayout}>
        <TileSparkChart spark={tile.spark} width={width} height={tile.spark.kind === "bars" ? 36 : 32} />
      </View>
      {tile.footer ? (
        <Text style={[styles.footer, tile.footerTone === "down" && { color: colors.bad }]}>{tile.footer}</Text>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, flexBasis: 0, minWidth: 0, minHeight: 132, padding: spacing.md },
  sub: { ...typeScale.micro, marginTop: 2 },
  spark: { marginTop: 8, minHeight: 32 },
  footer: { ...typeScale.micro, marginTop: 6 },
});
