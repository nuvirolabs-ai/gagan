import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, RefreshControl, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFounder } from "../context/FounderContext";
import { colors, spacing, type as typeScale } from "../theme";
import { PulseHeader } from "../components/PulseHeader";
import { HealthStrip } from "../components/HealthStrip";
import { KpiTileCard } from "../components/KpiTileCard";
import { PeriodTable } from "../components/PeriodTable";
import { NeedsYou } from "../components/NeedsYou";
import { Caps, DeltaText, Panel, Readout } from "../components/ui";
import { AreaChart } from "../components/charts/AreaChart";

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { today, refresh } = useFounder();
  const [refreshing, setRefreshing] = useState(false);
  const [chartW, setChartW] = useState(0);

  if (!today) {
    return <View style={styles.screen} />;
  }

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
      <PulseHeader
        brand={today.brand}
        title={today.title}
        rightTop={`${today.viewerName} · ${today.hub}`}
        rightBottom={today.asOfLabel}
      />
      <HealthStrip tone={today.health.tone} label={today.health.label} detail={today.health.detail} />

      <Panel style={styles.hero}>
        <View style={styles.heroTop}>
          <Caps>{today.salesHero.title}</Caps>
          <View style={styles.chips}>
            {(
              [
                { id: "day", delta: today.salesHero.day },
                { id: "week", delta: today.salesHero.week },
                { id: "month", delta: today.salesHero.month },
              ] as const
            ).map((chip) => (
              <View key={chip.id} style={[styles.chip, chip.id === "week" && styles.chipOn]}>
                <DeltaText delta={chip.delta} compact />
              </View>
            ))}
          </View>
        </View>
        <Text style={[typeScale.kpi, styles.heroValue]}>{today.salesHero.value}</Text>
        <Text style={styles.sub}>{today.salesHero.sub}</Text>
        <View style={styles.heroChart} onLayout={(e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width)}>
          {chartW > 0 ? <AreaChart series={today.salesHero.series} width={chartW} height={92} showAxis /> : null}
        </View>
      </Panel>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <KpiTileCard tile={today.tiles[0]} />
          <KpiTileCard tile={today.tiles[1]} />
        </View>
        <View style={styles.gridRow}>
          <KpiTileCard tile={today.tiles[2]} />
          <KpiTileCard tile={today.tiles[3]} />
        </View>
      </View>

      <PeriodTable title={today.periodTitle} rows={today.period} />
      <NeedsYou items={today.needsYou} />
      <Readout text={today.readout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  hero: { paddingBottom: spacing.md },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  chips: { flexDirection: "row", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", flex: 1 },
  chip: {
    backgroundColor: colors.panelAlt,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.chipOn,
    borderColor: colors.chipOnBorder,
  },
  heroValue: { fontSize: 32, letterSpacing: -0.6, marginTop: 4 },
  sub: { ...typeScale.meta, marginTop: 2 },
  heroChart: { marginTop: 10, height: 92 },
  grid: { gap: spacing.sm },
  gridRow: { flexDirection: "row", gap: spacing.sm },
});
