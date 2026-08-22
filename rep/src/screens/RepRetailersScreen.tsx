import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { colors, radius, spacing, shadow, inr, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader, SearchBar, EmptyState } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

export default function RepRetailersScreen({ navigation }: any) {
  const { rep } = useRep();
  const { t } = useLanguage();
  const [retailers, setRetailers] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ count: 0, outstanding: 0, overdue: 0 });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await repApi.retailers();
    setRetailers(res.retailers);
    setTotals(res.totals);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setRetailers([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return retailers;
    return retailers.filter(
      (r) => r.name.toLowerCase().includes(q) || r.phone.includes(q)
    );
  }, [retailers, query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("retailers.title")} subtitle={`Hi ${rep?.name ?? ""}`} />

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t("retailers.title")}</Text>
          <Text style={styles.metricValue}>{totals.count}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t("profile.outstanding")}</Text>
          <Text style={styles.metricValue}>{inr(totals.outstanding)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t("ledger.overdue")}</Text>
          <Text style={[styles.metricValue, totals.overdue > 0 && { color: colors.danger }]}>
            {inr(totals.overdue)}
          </Text>
        </View>
      </View>

      <SearchBar value={query} onChange={setQuery} placeholder={t("retailers.search")} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="store-outline"
              title={query ? "No match" : "No retailers assigned"}
              body={
                query
                  ? "Try a different name or number."
                  : "Ops will assign retailers to you from the admin dashboard."
              }
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: item.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name
                      .split(" ")
                      .map((p: string) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {item.phone} · {item.tier}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
              </View>

              <View style={styles.creditRow}>
                <View style={styles.creditCell}>
                  <Text style={styles.creditLabel}>{t("profile.outstanding")}</Text>
                  <Text style={styles.creditValue}>{inr(item.outstanding)}</Text>
                </View>
                <View style={styles.creditCell}>
                  <Text style={styles.creditLabel}>{t("profile.availableCredit")}</Text>
                  <Text style={[styles.creditValue, { color: colors.green }]}>
                    {inr(item.available)}
                  </Text>
                </View>
              </View>

              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, item.utilisationPct)}%`,
                      backgroundColor: item.utilisationPct >= 90 ? colors.danger : colors.green,
                    },
                  ]}
                />
              </View>

              {item.overdue > 0 && (
                <View style={styles.overdue}>
                  <Ionicons name="alert-circle" size={12} color={colors.danger} />
                  <Text style={styles.overdueText}>{inr(item.overdue)} overdue</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  metrics: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: { fontSize: 10.5, color: colors.inkMuted },
  metricValue: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 3 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "800", color: colors.green },
  name: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },

  creditRow: { flexDirection: "row", marginTop: spacing.lg },
  creditCell: { flex: 1 },
  creditLabel: { fontSize: 11, color: colors.inkMuted },
  creditValue: { fontSize: 14.5, fontWeight: "700", color: colors.ink, marginTop: 2 },

  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  fill: { height: "100%", borderRadius: 3 },
  overdue: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  overdueText: { fontSize: 11.5, color: colors.danger, fontWeight: "700" },
});
