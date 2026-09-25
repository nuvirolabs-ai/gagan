import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import type { FounderTrend, FounderTrends, TrendPeriod } from "../api/types";
import Segmented from "../components/Segmented";
import Sparkline from "../components/Sparkline";
import { usePreferences } from "../context/PreferencesContext";
import { formatMetricValue } from "../format/inr";
import { friendlyError } from "../pulse/viewState";
import { SCREEN_PAD_TOP } from "../theme";

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

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + SCREEN_PAD_TOP, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading && !!payload} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        <Text style={[styles.kicker, { color: colors.secondary }]}>TRENDS</Text>
        <Text style={[styles.title, { color: colors.label }]}>Trends</Text>
        <View style={{ marginTop: 16 }}>
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
        {error && !payload ? <Text style={[styles.body, { color: colors.label, marginTop: 24 }]}>{error}</Text> : null}
        {payload?.trends.map((trend) => (
          <TrendBlock key={trend.metric} trend={trend} colors={colors} />
        ))}
      </ScrollView>
    </View>
  );
}

function TrendBlock({
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
  return (
    <View style={{ marginTop: 32 }}>
      <Text style={[styles.interpretation, { color: colors.label }]}>{trend.interpretation}</Text>
      <Text
        style={[styles.value, { color: unavailable ? colors.tertiary : colors.label }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {unavailable ? "Unavailable" : formatMetricValue(trend.currentValue!, trend.unit)}
      </Text>
      <Text style={[styles.delta, { color: unavailable ? colors.tertiary : deltaColor }]}>
        {unavailable ? trend.unavailableReason ?? "Not yet available" : trend.comparison?.label ?? " "}
      </Text>
      <View style={{ marginTop: 12 }}>
        <Sparkline
          points={trend.points}
          colors={colors}
          formatValue={(value) => formatMetricValue(value, trend.unit)}
          positive={trend.metric === "overdue" || trend.metric === "fillRate" ? trend.comparison?.direction !== "down" : trend.comparison?.direction !== "down"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 1.6, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  interpretation: { fontSize: 22, fontWeight: "600", lineHeight: 28 },
  value: { fontSize: 34, fontWeight: "600", marginTop: 10, fontVariant: ["tabular-nums"] },
  delta: { fontSize: 15, marginTop: 4 },
  body: { fontSize: 17, lineHeight: 24 },
});
