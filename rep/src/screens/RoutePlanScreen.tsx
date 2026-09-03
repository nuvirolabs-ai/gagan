import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, spacing } from "../theme";
import type { SalesHomePayload } from "../types/home";

export default function RoutePlanScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [home, setHome] = useState<SalesHomePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      repApi.home()
        .then(setHome)
        .catch(() => setHome(null))
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.sky} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
      <Text style={styles.kicker}>{t("home.todaysRoute")}</Text>
      <Text style={styles.title}>{home?.territory ?? t("more.route")}</Text>
      <Text style={styles.sub}>
        {home?.route.planned ?? 0} {t("home.visits")} · {home?.route.done ?? 0} {t("home.done")}
      </Text>
      {(home?.route.stops ?? []).map((stop) => (
        <TouchableOpacity
          key={stop.id}
          style={styles.stop}
          onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: stop.id })}
        >
          <Text style={styles.time}>{stop.timeLabel}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{stop.name}</Text>
            <Text style={styles.area}>{stop.area}</Text>
          </View>
          <Text style={styles.status}>{stop.status}</Text>
        </TouchableOpacity>
      ))}
      {(home?.route.stops.length ?? 0) === 0 ? <Text style={styles.empty}>{t("home.routeEmpty")}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  kicker: { color: colors.inkMuted, fontWeight: "700", fontSize: 12, letterSpacing: 0.4 },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 4 },
  sub: { color: colors.inkMuted, marginTop: 6, marginBottom: spacing.lg },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  time: { width: 48, color: colors.inkMuted, fontWeight: "700" },
  name: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  area: { color: colors.inkMuted, marginTop: 2, fontSize: 12 },
  status: { color: colors.inkMuted, fontWeight: "800", fontSize: 11 },
  empty: { color: colors.inkMuted, marginTop: spacing.md },
});
