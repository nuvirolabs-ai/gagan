import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, RefreshControl, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFounder } from "../context/FounderContext";
import { colors, spacing, type as typeScale, toneColor } from "../theme";
import { HealthStrip } from "../components/HealthStrip";
import { KpiTileCard } from "../components/KpiTileCard";
import { PeriodChips } from "../components/PeriodChips";
import { VsPriorStrip } from "../components/VsPriorStrip";
import { Caps, Panel, Readout } from "../components/ui";
import { ColumnCompare } from "../components/charts/ColumnCompare";
import { HeatStrip } from "../components/charts/HeatStrip";

export default function SeriesScreen() {
  const insets = useSafeAreaInsets();
  const { series, seriesPeriod, setSeriesPeriod, refresh } = useFounder();
  const [refreshing, setRefreshing] = useState(false);
  const [chartW, setChartW] = useState(0);

  if (!series) return <View style={styles.screen} />;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={typeScale.brand}>Gagan · Founders</Text>
          <Text style={typeScale.display}>Series</Text>
        </View>
        <View style={{ paddingTop: 6 }}>
          <PeriodChips value={seriesPeriod} onChange={setSeriesPeriod} />
        </View>
      </View>

      <HealthStrip tone={series.healthTone} label={series.healthLine} detail="" trailing={series.hubNote} />

      <Panel>
        <View style={styles.heroMeta}>
          <View style={{ flex: 1 }}>
            <Caps>Sales trend · this {seriesPeriod}</Caps>
            <Text style={typeScale.kpi}>{series.salesHero.value}</Text>
          </View>
          <View style={styles.growth}>
            <Text style={[styles.growthPct, { color: toneColor(series.salesHero.growth.tone) }]}>
              {series.salesHero.growth.label}
            </Text>
            <Text style={typeScale.micro}>{series.salesHero.vsLabel}</Text>
          </View>
        </View>
        <Text style={styles.sub}>{series.salesHero.sub}</Text>
        <View style={styles.heroChart} onLayout={(e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width)}>
          {chartW > 0 ? (
            <>
              <ColumnCompare
                columns={series.salesHero.columns}
                width={chartW}
                height={108}
                showAxis
                xLabels={series.salesHero.xLabels}
                color={colors.up}
              />
              <View style={{ marginTop: 8 }}>
                <HeatStrip cells={series.salesHero.heat} width={chartW} height={8} color={colors.up} />
              </View>
            </>
          ) : null}
        </View>
      </Panel>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <KpiTileCard tile={series.tiles[0]} />
          <KpiTileCard tile={series.tiles[1]} />
        </View>
        <View style={styles.gridRow}>
          <KpiTileCard tile={series.tiles[2]} />
          <KpiTileCard tile={series.tiles[3]} />
        </View>
      </View>

      <VsPriorStrip title={series.vsPriorTitle} chips={series.vsPrior} />
      <Readout text={series.readout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  heroMeta: { flexDirection: "row", alignItems: "flex-start" },
  growth: { alignItems: "flex-end", paddingTop: 18 },
  growthPct: { fontSize: 18, fontWeight: "800" },
  sub: { ...typeScale.meta, marginTop: 2 },
  heroChart: { marginTop: 10, minHeight: 128 },
  grid: { gap: spacing.sm },
  gridRow: { flexDirection: "row", gap: spacing.sm },
});
