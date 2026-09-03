import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { useLanguage } from "../i18n/LanguageContext";
import { AchievementSheet } from "../components/AchievementSheet";
import { firstName, initials, localGreeting, mapsUrl } from "../home/format";
import { colors, inr, inrCompact, radius, shadow, spacing, TAB_BAR_SPACE } from "../theme";
import type { SalesHomePayload } from "../types/home";

export default function OceanHomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { staff } = useRep();
  const { t } = useLanguage();
  const [home, setHome] = useState<SalesHomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetMilestone, setSheetMilestone] = useState<number | null>(null);

  const load = useCallback(async () => {
    const payload = (await repApi.home()) as SalesHomePayload;
    setHome(payload);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load()
        .catch(() => {
          if (!cancelled) setHome(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => undefined);
    setRefreshing(false);
  };

  if (loading && !home) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.sky} />
      </View>
    );
  }

  const name = firstName(home?.staff.name ?? staff?.name);
  const greetingKey = `home.${localGreeting()}` as const;
  const next = home?.route.next ?? null;
  const remaining = home?.route.remaining ?? 0;
  const dailyPct = home?.sales.dailyPct ?? 0;
  const weeklyPct = home?.sales.weeklyPct ?? 0;
  const currentMilestone = home?.sales.currentMilestone ?? null;

  const openNext = () => {
    if (!next) return navigation.navigate("Retailers");
    navigation.navigate("RepRetailerDetail", { retailerId: next.id });
  };

  const navigateNext = () => {
    if (!next) return;
    void Linking.openURL(mapsUrl(`${next.name}, ${next.address}`));
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_SPACE + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sky} />}
      >
        <View style={styles.header}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(home?.staff.name ?? staff?.name)}</Text>
              <View style={styles.online} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>{t(greetingKey)}, {name}</Text>
              <Text style={styles.sub}>
                {remaining} {t("home.stopsLeft")} · {home?.route.onTrack ? t("home.onTrack") : t("home.behind")}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Retailers")} accessibilityLabel={t("common.search")}>
              <Ionicons name="search" size={18} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Approvals")} accessibilityLabel={t("home.notifications")}>
              <Ionicons name="notifications-outline" size={18} color={colors.ink} />
              {(home?.badges.notifications ?? 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{home?.badges.notifications}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.nextPill}>
              <Text style={styles.nextPillText}>
                {t("home.next")} · {next?.timeLabel ?? "—"}
              </Text>
            </View>
            <Text style={styles.heroMeta}>{next ? t("home.onBeat") : t("home.noStops")}</Text>
          </View>
          <Text style={styles.heroName}>{next?.name ?? t("home.noNextVisit")}</Text>
          <Text style={styles.heroAddr}>{next ? `${next.area}${next.address && next.address !== next.area ? `, ${next.address}` : ""}` : t("home.routeEmpty")}</Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.startBtn} onPress={openNext} disabled={!next}>
              <Text style={styles.startText}>{t("home.startVisit")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={navigateNext} disabled={!next}>
              <Text style={[styles.navText, !next && { opacity: 0.4 }]}>{t("home.navigate")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.salesHead}>
          <View>
            <Text style={styles.salesLabel}>{t("home.todaysSales")}</Text>
            <Text style={styles.salesValue}>{inr(home?.sales.today ?? 0)}</Text>
          </View>
          <Text style={styles.targetLabel}>
            {t("home.dailyTarget")} {inr(home?.sales.dailyTarget ?? 0)}
          </Text>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressKicker}>{t("home.daily")}</Text>
              <Text style={styles.progressPct}>{dailyPct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fillNavy, { width: `${Math.min(100, dailyPct)}%` }]} />
            </View>
            <Text style={styles.progressFoot}>
              {inrCompact(home?.sales.today ?? 0)} {t("home.of")} {inrCompact(home?.sales.dailyTarget ?? 0)}
            </Text>
          </View>
          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressKicker}>{t("home.weekly")}</Text>
              <Text style={styles.progressPct}>{weeklyPct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fillSky, { width: `${Math.min(100, weeklyPct)}%` }]} />
            </View>
            <Text style={styles.progressFoot}>
              {inrCompact(home?.sales.week ?? 0)} {t("home.of")} {inrCompact(home?.sales.weeklyTarget ?? 0)}
            </Text>
          </View>
        </View>

        <View style={styles.chips}>
          {(home?.sales.milestones ?? [25, 50, 75, 80]).map((mark) => {
            const hit = (home?.sales.hitMilestones ?? []).includes(mark);
            const current = currentMilestone === mark;
            return (
              <TouchableOpacity
                key={mark}
                style={[styles.chip, hit && styles.chipHit, current && styles.chipCurrent, !hit && styles.chipPending]}
                onPress={() => setSheetMilestone(mark)}
                accessibilityLabel={`${mark}%`}
              >
                <Text style={[styles.chipText, hit && styles.chipTextHit, !hit && styles.chipTextPending]}>{mark}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{home?.route.planned ?? 0}</Text>
            <Text style={styles.statLabel}>{t("home.visits")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{home?.route.done ?? 0}</Text>
            <Text style={styles.statLabel}>{t("home.done")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{home?.route.coveragePct ?? 0}%</Text>
            <Text style={styles.statLabel}>{t("home.coverage")}</Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t("home.todaysRoute")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("RoutePlan")}>
            <Text style={styles.link}>{t("home.fullPlan")}</Text>
          </TouchableOpacity>
        </View>
        {(home?.route.stops ?? []).slice(0, 4).map((stop) => (
          <TouchableOpacity
            key={stop.id}
            style={styles.stop}
            onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: stop.id })}
          >
            <Text style={styles.stopTime}>{stop.timeLabel}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stopName}>{stop.name}</Text>
              <Text style={styles.stopArea}>{stop.area}</Text>
            </View>
            <Text style={styles.stopStatus}>{stop.status}</Text>
          </TouchableOpacity>
        ))}
        {(home?.route.stops.length ?? 0) === 0 ? (
          <Text style={styles.emptyRoute}>{t("home.routeEmpty")}</Text>
        ) : null}
      </ScrollView>
      <AchievementSheet
        visible={sheetMilestone != null}
        home={home}
        milestone={sheetMilestone}
        onClose={() => setSheetMilestone(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  identity: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onDark, fontWeight: "800", fontSize: 14 },
  online: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3DDC97",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  hello: { fontSize: 18, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.onDark, fontSize: 9, fontWeight: "800" },
  hero: {
    backgroundColor: colors.navy,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextPill: {
    backgroundColor: colors.sky,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextPillText: { color: colors.onDark, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  heroMeta: { color: colors.onDarkMuted, fontSize: 12, fontWeight: "600" },
  heroName: { color: colors.onDark, fontSize: 26, fontWeight: "800", marginTop: 14, lineHeight: 30 },
  heroAddr: { color: colors.onDarkMuted, fontSize: 13.5, marginTop: 6 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 20 },
  startBtn: {
    flex: 1,
    backgroundColor: colors.sky,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  startText: { color: colors.onDark, fontWeight: "800", fontSize: 15 },
  navText: { color: colors.onDark, fontWeight: "700", fontSize: 15, paddingHorizontal: 8 },
  salesHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  salesLabel: { color: colors.inkMuted, fontSize: 13, fontWeight: "600" },
  salesValue: { color: colors.ink, fontSize: 32, fontWeight: "800", marginTop: 2 },
  targetLabel: { color: colors.inkMuted, fontSize: 12.5, fontWeight: "600", marginBottom: 6 },
  progressRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  progressCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  progressKicker: { fontSize: 11, fontWeight: "800", color: colors.inkMuted, letterSpacing: 0.6 },
  progressPct: { fontSize: 20, fontWeight: "800", color: colors.ink },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.track, overflow: "hidden", marginTop: 10 },
  fillNavy: { height: "100%", backgroundColor: colors.navy, borderRadius: 4 },
  fillSky: { height: "100%", backgroundColor: colors.sky, borderRadius: 4 },
  progressFoot: { color: colors.inkMuted, fontSize: 11.5, fontWeight: "600", marginTop: 8 },
  chips: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: 8, marginBottom: spacing.xl },
  chip: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: colors.skySoft,
  },
  chipHit: { backgroundColor: colors.skySoft },
  chipCurrent: { borderWidth: 3, borderColor: colors.navy },
  chipPending: { backgroundColor: colors.track },
  chipText: { fontWeight: "800", color: colors.navy, fontSize: 13 },
  chipTextHit: { color: colors.navy },
  chipTextPending: { color: colors.inkMuted },
  statRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 12, color: colors.inkMuted, marginTop: 2, fontWeight: "600" },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  link: { color: colors.inkMuted, fontWeight: "700", fontSize: 13 },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stopTime: { width: 48, color: colors.inkMuted, fontWeight: "700", fontSize: 13 },
  stopName: { color: colors.ink, fontWeight: "800", fontSize: 14.5 },
  stopArea: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  stopStatus: { color: colors.inkMuted, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  emptyRoute: { color: colors.inkMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
