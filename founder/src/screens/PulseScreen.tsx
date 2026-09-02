import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { founderApi } from "../api/founder";
import { useAuth } from "../context/AuthContext";
import { formatDelta, formatInrExecutive, formatMetricValue } from "../format/inr";
import { friendlyError, pulseViewState, type FounderMetric, type FounderPulse } from "../pulse/viewState";
import { useNavigation } from "@react-navigation/native";
import { usePreferences } from "../context/PreferencesContext";
import type { Tokens } from "../theme";

function statusColor(status: string, colors: Tokens) {
  if (status === "AT_RISK") return colors.negative;
  if (status === "WATCH") return colors.warning;
  return colors.positive;
}

function MetricTile({ metric, colors }: { metric: FounderMetric; colors: Tokens }) {
  const unavailable = metric.availability !== "available" || metric.value == null;
  const deltaColor =
    metric.delta?.direction === "down" ? colors.negative : metric.delta?.direction === "up" ? colors.positive : colors.secondary;
  return (
    <View style={styles.tile}>
      <Text style={[styles.metricLabel, { color: colors.secondary }]}>{metric.label.toUpperCase()}</Text>
      <Text
        style={[styles.metricValue, { color: unavailable ? colors.tertiary : colors.label }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {unavailable ? "Unavailable" : formatMetricValue(metric.value!, metric.unit)}
      </Text>
      <Text style={[styles.metricDelta, { color: unavailable ? colors.tertiary : deltaColor }]}>
        {unavailable
          ? metric.unavailableReason ?? "Not yet available"
          : metric.delta
            ? formatDelta(metric.delta.amount, metric.delta.unit, metric.delta.direction)
            : " "}
      </Text>
    </View>
  );
}

function PulseReady({
  pulse,
  colors,
  onOpenBrief,
  onOpenIssue,
  onOpenTeam,
}: {
  pulse: FounderPulse;
  colors: Tokens;
  onOpenBrief: () => void;
  onOpenIssue: (id: string) => void;
  onOpenTeam: () => void;
}) {
  const headlines = pulse.metrics.slice(0, 4);
  return (
    <>
      <Text style={[styles.kicker, { color: colors.secondary }]}>PULSE</Text>
      <Text style={[styles.title, { color: colors.label }]}>Pulse</Text>
      <Text style={[styles.greeting, { color: colors.secondary }]}>{pulse.summary.greeting}</Text>
      <Text style={[styles.date, { color: colors.tertiary }]}>{pulse.period.label}</Text>
      <Text style={[styles.headline, { color: colors.label }]}>{pulse.summary.headline}</Text>
      <Pressable onPress={onOpenBrief} style={{ marginTop: 10 }}>
        <Text style={[styles.rowBody, { color: colors.info }]}>Morning / evening brief</Text>
      </Pressable>

      <View style={[styles.grid, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
        <View style={styles.row}>
          {headlines.slice(0, 2).map((metric) => (
            <MetricTile key={metric.id} metric={metric} colors={colors} />
          ))}
        </View>
        <View style={[styles.hairline, { backgroundColor: colors.separator }]} />
        <View style={styles.row}>
          {headlines.slice(2, 4).map((metric) => (
            <MetricTile key={metric.id} metric={metric} colors={colors} />
          ))}
        </View>
      </View>

      <Text style={[styles.section, { color: colors.secondary }]}>WHAT CHANGED</Text>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {pulse.changes.length === 0 ? (
          <Text style={[styles.rowBody, { color: colors.secondary }]}>Trading is in line with the comparable day.</Text>
        ) : (
          pulse.changes.map((change, index) => (
            <View
              key={change.id}
              style={[styles.listRow, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}
            >
              <Text style={[styles.rowTitle, { color: colors.label }]}>{change.title}</Text>
              <Text style={[styles.rowBody, { color: colors.secondary }]}>{change.explanation}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.section, { color: colors.secondary }]}>BUSINESS STUCK</Text>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        <Text style={[styles.stuckValue, { color: colors.label }]}>
          {formatInrExecutive(pulse.blocked.totalUniqueValue)} currently blocked
        </Text>
        {pulse.blocked.categories.length === 0 ? (
          <Text style={[styles.rowBody, { color: colors.secondary }]}>No open orders are held by a known constraint.</Text>
        ) : (
          pulse.blocked.categories.map((category) => (
            <View key={category.id} style={styles.stuckRow}>
              <Text style={[styles.rowTitle, { color: colors.label }]}>{category.id}</Text>
              <Text style={[styles.rowMeta, { color: colors.secondary }]}>{formatInrExecutive(category.uniqueValue)}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.section, { color: colors.secondary }]}>NEEDS YOUR ATTENTION</Text>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        <Text style={[styles.rowTitle, { color: colors.label }]}>{pulse.pendingDecisions.label}</Text>
        {pulse.issues.map((issue) => (
          <Pressable
            key={issue.id}
            onPress={() => onOpenIssue(issue.id)}
            style={[styles.listRow, { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <Text style={[styles.severity, { color: statusColor(issue.severity === "WATCH" ? "WATCH" : "AT_RISK", colors) }]}>
              {issue.severity}
            </Text>
            <Text style={[styles.rowTitle, { color: colors.label }]}>{issue.title}</Text>
            <Text style={[styles.rowBody, { color: colors.secondary }]}>
              {issue.explanation} · {issue.owner}
            </Text>
          </Pressable>
        ))}
        {pulse.issues.length === 0 && pulse.pendingDecisions.count === 0 ? (
          <Text style={[styles.rowBody, { color: colors.secondary, marginTop: 8 }]}>
            No critical system issues detected.
          </Text>
        ) : null}
      </View>

      <Text style={[styles.section, { color: colors.secondary }]}>HEALTH</Text>
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {pulse.health.map((domain, index) => (
          <View
            key={domain.domain}
            style={[styles.healthRow, index > 0 ? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth } : null]}
          >
            <Pressable style={{ flex: 1 }} onPress={domain.domain === "Sales Team" ? onOpenTeam : undefined}>
              <View style={styles.healthTitleRow}>
                <Text style={[styles.rowTitle, { color: colors.label }]}>{domain.domain}</Text>
                <Text style={[styles.healthStatus, { color: statusColor(domain.status, colors) }]}>
                  {domain.status.replace("_", " ")}
                </Text>
              </View>
              <Text style={[styles.rowBody, { color: colors.secondary }]}>{domain.reason}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ height: 28 }} />
    </>
  );
}

export default function PulseScreen({ preview }: { preview?: FounderPulse }) {
  const { colors } = usePreferences();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { identity } = useAuth();
  const [pulse, setPulse] = useState<FounderPulse | null>(preview ?? null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview) return;
    setError(null);
    try {
      const next = await founderApi.pulse();
      setPulse(next);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    void load();
  }, [load, preview]);

  const view = pulseViewState({ loading, error, pulse });

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading && !!pulse} onRefresh={() => { setLoading(true); void load(); }} />}
      >
        <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12} style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: colors.fill }]}>
            <Text style={[styles.avatarLetter, { color: colors.label }]}>
              {(identity?.name ?? "F").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        </Pressable>

        {view.status === "loading" ? (
          <View>
            <Text style={[styles.title, { color: colors.label }]}>Pulse</Text>
            <View style={[styles.skeleton, { backgroundColor: colors.fill }]} />
            <View style={[styles.skeleton, { backgroundColor: colors.fill, width: "80%" }]} />
            <View style={[styles.grid, { backgroundColor: colors.surface, minHeight: 180 }]} />
          </View>
        ) : null}

        {view.status === "error" ? (
          <View>
            <Text style={[styles.title, { color: colors.label }]}>Pulse</Text>
            <Text style={[styles.headline, { color: colors.label }]}>{view.message}</Text>
            <Pressable onPress={() => { setLoading(true); void load(); }}>
              <Text style={{ color: colors.info, fontSize: 17, marginTop: 16 }}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {view.status === "ready" ? (
          <PulseReady
            pulse={view.pulse}
            colors={colors}
            onOpenBrief={() => navigation.navigate("Brief")}
            onOpenIssue={(id) => navigation.navigate("IssueDetail", { id })}
            onOpenTeam={() => navigation.navigate("Team")}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatarWrap: { alignSelf: "flex-end", marginBottom: -8, zIndex: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 15, fontWeight: "600" },
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 1.6, marginBottom: 4 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.35 },
  greeting: { fontSize: 17, marginTop: 14 },
  date: { fontSize: 15, marginTop: 2 },
  headline: { fontSize: 22, fontWeight: "600", lineHeight: 28, marginTop: 18 },
  grid: { marginTop: 22, borderRadius: 12, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row" },
  tile: { flex: 1, paddingHorizontal: 14, paddingVertical: 16 },
  hairline: { height: StyleSheet.hairlineWidth },
  metricLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8 },
  metricValue: { fontSize: 28, fontWeight: "600", marginTop: 6, fontVariant: ["tabular-nums"] },
  metricDelta: { fontSize: 13, marginTop: 6 },
  section: { marginTop: 28, marginBottom: 8, fontSize: 13, fontWeight: "600", letterSpacing: 1.2 },
  group: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  listRow: { paddingVertical: 12 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  rowBody: { fontSize: 15, lineHeight: 20, marginTop: 4 },
  rowMeta: { fontSize: 17, fontVariant: ["tabular-nums"] },
  stuckValue: { fontSize: 20, fontWeight: "600", marginBottom: 10 },
  stuckRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  severity: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 4 },
  healthRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  healthTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  healthStatus: { fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  skeleton: { height: 18, borderRadius: 6, marginTop: 12 },
});
