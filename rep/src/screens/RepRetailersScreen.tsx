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
  CustomerRowSkeleton,
  EmptyState,
  FilterChip,
  FilterChipRow,
  ProgressRow,
  SearchBar,
  StatusChip,
  Surface,
  useHeaderPaddingTop,
} from "../components/ui";
import { staffCapabilities } from "../auth/staffCapabilities";
import { useLanguage } from "../i18n/LanguageContext";

type Filter = "all" | "route" | "overdue" | "opportunities";

function OutletCard({
  item,
  chip,
  dueLabel,
  dueTone,
  creditLabel,
  onPress,
}: {
  item: any;
  chip?: { label: string; tone: "green" | "gold" | "danger" | "warning" | "neutral" };
  dueLabel: string;
  dueTone: "ink" | "danger";
  creditLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.78}
      style={styles.outletCard}
    >
      <View style={styles.outletCardTop}>
        <View style={styles.outletAvatar}>
          <Text style={styles.outletAvatarText}>{String(item.name ?? "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.outletIdentity}>
          <Text style={styles.outletName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.outletMeta} numberOfLines={1}>{item.shopAddress || item.phone || "Assigned account"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
      </View>
      <View style={styles.outletRule} />
      <View style={styles.outletBottom}>
        <View style={styles.outletMoney}>
          <Text style={[styles.outletDue, dueTone === "danger" && styles.outletDueDanger]} numberOfLines={1}>{dueLabel}</Text>
          <Text style={styles.outletCredit} numberOfLines={1}>{creditLabel}</Text>
        </View>
        {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : <Text style={styles.outletQuiet}>Open account</Text>}
      </View>
    </TouchableOpacity>
  );
}

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

  const routeProgress = today?.route?.progress;
  const routeTotal = Number(routeProgress?.total) || 0;
  const routeVisited = (Number(routeProgress?.visited) || 0) + (Number(routeProgress?.skipped) || 0);
  const routeCompletion = Number(routeProgress?.completionPct) || 0;

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

      {today?.route && routeTotal > 0 ? (
        <Surface level={1} style={styles.routeSummary}>
          <View style={styles.routeSummaryHead}>
            <View>
              <Text style={styles.routeSummaryKicker}>TODAY’S ROUTE</Text>
              <Text style={styles.routeSummaryTitle}>{routeVisited} of {routeTotal} stops complete</Text>
            </View>
            <Text style={styles.routeSummaryPct}>{routeCompletion}%</Text>
          </View>
          <ProgressRow pct={routeCompletion} tone="green" />
        </Surface>
      ) : null}

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
              <OutletCard
                item={item}
                chip={chip}
                dueLabel={overdue ? t("retailers.overdueAmount", { amount: inr(item.overdue) }) : t("retailers.due", { amount: inr(item.outstanding) })}
                dueTone={overdue ? "danger" : "ink"}
                creditLabel={t("retailers.credit", { amount: inr(item.available) })}
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
  routeSummary: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderRadius: radius.xl,
  },
  routeSummaryHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  routeSummaryKicker: { color: colors.blueInk, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  routeSummaryTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 3 },
  routeSummaryPct: { color: colors.blueInk, fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  skel: { paddingTop: spacing.sm },
  divider: { height: spacing.md },
  outletCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  outletCardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  outletAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  outletAvatarText: { color: colors.blueInk, fontSize: 16, fontWeight: "800" },
  outletIdentity: { flex: 1, minWidth: 0, gap: 3 },
  outletName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  outletMeta: { color: colors.inkMuted, fontSize: 12.5 },
  outletRule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  outletBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  outletMoney: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  outletDue: { color: colors.ink, fontSize: 12.5, fontWeight: "700" },
  outletDueDanger: { color: colors.danger },
  outletCredit: { color: colors.inkMuted, fontSize: 12.5 },
  outletQuiet: { color: colors.inkFaint, fontSize: 11, fontWeight: "600" },
});
