import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderTrend, FounderTrends, TrendPeriod } from "../api/types";
import CompareBars from "../components/CompareBars";
import Segmented from "../components/Segmented";
import Sparkline from "../components/Sparkline";
import { usePreferences } from "../context/PreferencesContext";
import { formatMetricValue } from "../format/inr";
import { friendlyError } from "../pulse/viewState";

function pickTrend(trends: FounderTrend[], id: string) {
  return trends.find((trend) => trend.metric === id);
}

export default function TrendsScreen() {
  const { colors, preferences } = usePreferences();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<TrendPeriod>(preferences.defaultPeriod);
  const [payload, setPayload] = useState<FounderTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next = period) => {
    setError(null);
    try {
      setPayload(await founderApi.trends(next));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    void load(period);
  }, [load, period]);

  const trends = payload?.trends ?? [];
  const hero = pickTrend(trends, "orders") ?? trends[0];
  const rest = trends.filter((trend) => trend !== hero);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading && !!payload} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brand, { color: colors.secondary }]}>GAGAN · FOUNDERS</Text>
            <Text style={[styles.title, { color: colors.label }]}>Series</Text>
          </View>
          <View style={{ width: 200, paddingTop: 6 }}>
            <Segmented
              value={period}
              options={[
                { id: "7D", label: "7D" },
                { id: "30D", label: "30D" },
                { id: "90D", label: "90D" },
              ]}
              onChange={setPeriod}
              colors={colors}
            />
          </View>
        </View>
        {error && !payload ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}

        {hero ? <HeroTrend trend={hero} period={period} colors={colors} /> : null}

        <View style={styles.grid}>
          {chunk(rest.slice(0, 4), 2).map((row, index) => (
            <View key={index} style={styles.gridRow}>
              {row.map((trend) => (
                <TrendTile key={trend.metric} trend={trend} colors={colors} />
              ))}
            </View>
          ))}
        </View>

        {trends.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={[styles.section, { color: colors.secondary }]}>VS PRIOR {period} · FIVE KPIS</Text>
            <View style={styles.strip}>
              {trends.slice(0, 5).map((trend) => (
                <View key={trend.metric} style={[styles.stripChip, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
                  <Text style={[styles.stripName, { color: colors.secondary }]} numberOfLines={1}>
                    {trend.label}
                  </Text>
                  <Text
                    style={[
                      styles.stripDelta,
                      {
                        color:
                          trend.comparison?.direction === "down"
                            ? colors.negative
                            : trend.comparison?.direction === "up"
                              ? colors.positive
                              : colors.secondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {trend.comparison?.label ?? "—"}
                  </Text>
                  <Sparkline points={trend.points} colors={colors} variant={sparkVariant(trend.metric)} height={18} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {hero ? (
          <View style={[styles.readout, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
            <Text style={[styles.readoutInk, { color: colors.label }]}>Readout · </Text>
            <Text style={[styles.body, { color: colors.secondary }]}>{hero.interpretation}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function sparkVariant(metric: string): "line" | "area" | "columns" | "heat" {
  if (metric === "orders") return "columns";
  if (metric === "collections") return "columns";
  if (metric === "fillRate" || metric === "blocked" || metric === "overdue") return "heat";
  return "area";
}

function HeroTrend({
  trend,
  period,
  colors,
}: {
  trend: FounderTrend;
  period: TrendPeriod;
  colors: ReturnType<typeof usePreferences>["colors"];
}) {
  const unavailable = trend.availability !== "available" || trend.currentValue == null;
  const deltaColor =
    trend.comparison?.direction === "down"
      ? colors.negative
      : trend.comparison?.direction === "up"
        ? colors.positive
        : colors.secondary;
  return (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
      <Text style={[styles.metricLabel, { color: colors.secondary }]}>
        {trend.label.toUpperCase()} · {period}
      </Text>
      <View style={styles.heroMeta}>
        <Text
          style={[styles.heroValue, { color: unavailable ? colors.tertiary : colors.label }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {unavailable ? "Unavailable" : formatMetricValue(trend.currentValue!, trend.unit)}
        </Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.heroDelta, { color: unavailable ? colors.tertiary : deltaColor }]}>
            {unavailable ? trend.unavailableReason ?? "Not yet available" : trend.comparison?.label ?? " "}
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <Sparkline points={trend.points} colors={colors} variant="columns" height={108} />
        <View style={{ marginTop: 8 }}>
          <Sparkline points={trend.points} colors={colors} variant="heat" height={16} />
        </View>
      </View>
    </View>
  );
}

function TrendTile({
  trend,
  colors,
}: {
  trend: FounderTrend;
  colors: ReturnType<typeof usePreferences>["colors"];
}) {
  const unavailable = trend.availability !== "available" || trend.currentValue == null;
  const deltaColor =
    trend.comparison?.direction === "down"
      ? colors.negative
      : trend.comparison?.direction === "up"
        ? colors.positive
        : colors.secondary;
  const previous = trend.comparison?.previousValue;
  const showBars = trend.currentValue != null && previous != null;
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
      <Text style={[styles.metricLabel, { color: colors.secondary }]}>{trend.label.toUpperCase()}</Text>
      <Text style={[styles.tileValue, { color: unavailable ? colors.tertiary : colors.label }]} numberOfLines={1} adjustsFontSizeToFit>
        {unavailable ? "Unavailable" : formatMetricValue(trend.currentValue!, trend.unit)}
      </Text>
      <Text style={[styles.tileDelta, { color: unavailable ? colors.tertiary : deltaColor }]}>
        {unavailable ? trend.unavailableReason ?? "Not yet available" : trend.comparison?.label ?? " "}
      </Text>
      {showBars ? (
        <CompareBars current={trend.currentValue!} previous={previous!} colors={colors} />
      ) : (
        <Sparkline points={trend.points} colors={colors} variant={sparkVariant(trend.metric)} height={36} />
      )}
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  brand: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  title: { fontSize: 34, fontWeight: "800", letterSpacing: -0.6 },
  section: { fontSize: 10, fontWeight: "700", letterSpacing: 1.1, marginBottom: 8 },
  hero: { marginTop: 14, borderRadius: 16, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  heroMeta: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  heroValue: { fontSize: 32, fontWeight: "800", marginTop: 6, fontVariant: ["tabular-nums"], flex: 1 },
  heroDelta: { fontSize: 16, fontWeight: "800" },
  metricLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  grid: { marginTop: 10, gap: 8 },
  gridRow: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, flexBasis: 0, minWidth: 0, borderRadius: 16, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  tileValue: { fontSize: 20, fontWeight: "800", marginTop: 6, fontVariant: ["tabular-nums"] },
  tileDelta: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  strip: { flexDirection: "row", gap: 6 },
  stripChip: { flex: 1, borderRadius: 12, padding: 7, borderWidth: StyleSheet.hairlineWidth },
  stripName: { fontSize: 10, fontWeight: "600" },
  stripDelta: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  readout: { marginTop: 16, borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap" },
  readoutInk: { fontSize: 13, fontWeight: "700" },
  body: { fontSize: 13, lineHeight: 18 },
});
