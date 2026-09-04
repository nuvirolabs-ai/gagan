import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { useField } from "../context/FieldContext";
import { colors, inr, radius, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import {
  AppScreen,
  CustomerRow,
  CustomerRowSkeleton,
  EmptyState,
  FilterChip,
  FilterChipRow,
  SearchBar,
  useHeaderPaddingTop,
} from "../components/ui";
import { staffCapabilities } from "../auth/staffCapabilities";
import { useLanguage } from "../i18n/LanguageContext";

type Filter = "all" | "route" | "overdue" | "opportunities";

export default function RepRetailersScreen({ navigation }: any) {
  const { staff } = useRep();
  const { today } = useField();
  const { t } = useLanguage();
  const headerPaddingTop = useHeaderPaddingTop();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ count: 0, outstanding: 0, overdue: 0 });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
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

  const routeIds = useMemo(
    () => new Set((today?.route?.stops ?? []).map((stop: any) => stop.retailer?.id ?? stop.retailerId)),
    [today]
  );
  const opportunityIds = useMemo(
    () => new Set((today?.opportunities?.actions ?? []).map((action: any) => action.retailerId)),
    [today]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return retailers.filter((r) => {
      const matchesQuery = !q || r.name.toLowerCase().includes(q) || r.phone.includes(q);
      if (!matchesQuery) return false;
      if (filter === "route") return routeIds.has(r.id);
      if (filter === "overdue") return Number(r.overdue) > 0;
      if (filter === "opportunities") return opportunityIds.has(r.id);
      return true;
    });
  }, [retailers, query, filter, routeIds, opportunityIds]);

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: t("retailers.filterAll") },
    { id: "route", label: t("retailers.filterRoute") },
    { id: "overdue", label: t("retailers.filterOverdue") },
    { id: "opportunities", label: t("retailers.filterOpportunities") },
  ];

  return (
    <AppScreen>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("retailers.title")}</Text>
          <Text style={styles.sub}>{t("retailers.accounts", { count: totals.count })}</Text>
        </View>
        {capabilities.canProposeRetailers ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate("AddRetailer")}
            accessibilityLabel={t("addRetailer.title")}
          >
            <Ionicons name="add" size={18} color={colors.onDark} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.summary} numberOfLines={2}>
        {totals.count} · {inr(totals.outstanding)} outstanding
        {totals.overdue > 0 ? ` · ${inr(totals.overdue)} overdue` : ""}
      </Text>

      <SearchBar value={query} onChange={setQuery} placeholder={t("retailers.search")} />

      <FilterChipRow>
        {filters.map((item) => (
          <FilterChip
            key={item.id}
            label={item.label}
            active={filter === item.id}
            onPress={() => setFilter(item.id)}
          />
        ))}
      </FilterChipRow>

      {loading && retailers.length === 0 ? (
        <View style={styles.skel}>
          <CustomerRowSkeleton />
          <CustomerRowSkeleton />
          <CustomerRowSkeleton />
          <CustomerRowSkeleton />
          <CustomerRowSkeleton />
          <CustomerRowSkeleton />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: SCREEN_CONTENT_BOTTOM_GAP }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            <EmptyState
              icon="store-outline"
              title={query || filter !== "all" ? t("retailers.noMatch") : t("retailers.noneAssigned")}
              body={query || filter !== "all" ? t("retailers.noMatchBody") : t("retailers.noneAssignedBody")}
            />
          }
          renderItem={({ item }) => {
            const overdue = Number(item.overdue) > 0;
            const onRoute = routeIds.has(item.id);
            const chip = overdue
              ? { label: t("retailers.filterOverdue"), tone: "danger" as const }
              : onRoute
                ? { label: t("retailers.routeToday"), tone: "green" as const }
                : item.tier?.toLowerCase() === "gold"
                  ? { label: t("retailers.gold"), tone: "gold" as const }
                  : undefined;
            return (
              <CustomerRow
                name={item.name}
                chip={chip}
                dueLabel={overdue ? t("retailers.overdueAmount", { amount: inr(item.overdue) }) : t("retailers.due", { amount: inr(item.outstanding) })}
                dueTone={overdue ? "danger" : "ink"}
                creditLabel={t("retailers.credit", { amount: inr(item.available) })}
                meta={item.phone}
                onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: item.id })}
              />
            );
          }}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.6 },
  sub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  summary: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  skel: { paddingTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.separator, marginLeft: 76 },
});
