import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { AppScreen, Card, EmptyState, SectionTitle, Tag } from "../components/ui";
import { repApi } from "../api/repClient";
import { colors, radius, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const ICONS: Record<string, string> = {
  ORDER_DUE: "time-outline",
  HIGH_VALUE_RETAILER_MISSED: "alert-circle-outline",
  VISIT_OVERDUE: "walk-outline",
  COLLECTION_DUE: "cash-outline",
  ORDER_VALUE_BELOW_NORMAL: "trending-down-outline",
  LINE_ITEMS_BELOW_NORMAL: "list-outline",
  CATEGORY_REORDER_OPPORTUNITY: "cube-outline",
};

/** Money already owed is the one thing shown in the alarm colour. */
function toneFor(type: string): "gold" | "danger" | "neutral" {
  if (type === "COLLECTION_DUE") return "danger";
  if (type === "HIGH_VALUE_RETAILER_MISSED" || type === "ORDER_DUE") return "gold";
  return "neutral";
}

/**
 * Everything the intelligence engine currently finds, with the measurements
 * that produced each one. Nothing here is a prediction: each card says what was
 * observed and what it suggests, and the salesperson decides.
 */
export default function OpportunitiesScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await repApi.opportunities(25));
    } catch {
      setData(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  const triggers: any[] = data?.triggers ?? [];

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.green}
          />
        }
      >
        {(data?.summary ?? []).length > 0 ? (
          <Card>
            <SectionTitle title={t("opportunities.title")} />
            {data.summary.map((line: any) => (
              <Text key={line.type} style={styles.summary}>
                • {line.headline}
              </Text>
            ))}
            <Text style={styles.footnote}>
              {t("opportunities.basedOn", { days: String(data.windowDays) })} ·{" "}
              {data.retailersConsidered} stores
            </Text>
          </Card>
        ) : null}

        {triggers.length === 0 ? (
          <EmptyState
            icon="check-circle-outline"
            title={t("opportunities.empty")}
            body={t("opportunities.emptyBody")}
          />
        ) : (
          triggers.map((trigger: any) => (
            <TouchableOpacity
              key={`${trigger.type}-${trigger.retailerId}`}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate("RepRetailerDetail", { retailerId: trigger.retailerId })
              }
            >
              <Card>
                <View style={styles.head}>
                  <View style={styles.icon}>
                    <Ionicons
                      name={(ICONS[trigger.type] ?? "bulb-outline") as any}
                      size={17}
                      color={colors.accentStrong}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.retailer} numberOfLines={2}>
                      {trigger.retailerName}
                    </Text>
                    <Text style={styles.headline} numberOfLines={3}>
                      {trigger.headline}
                    </Text>
                  </View>
                  <Tag label={trigger.recommendedAction} tone={toneFor(trigger.type)} />
                </View>

                <Text style={styles.whyLabel}>{t("opportunities.why")}</Text>
                <Text style={styles.why}>{trigger.why}</Text>

                <View style={styles.measurements}>
                  {trigger.measurements.map((measurement: any) => (
                    <View key={measurement.label} style={styles.measurement}>
                      <Text style={styles.measurementLabel}>{measurement.label}</Text>
                      <Text style={styles.measurementValue}>{measurement.value}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  summary: { fontSize: 13.5, color: colors.ink, lineHeight: 21 },
  footnote: { fontSize: 11.5, color: colors.inkFaint, marginTop: spacing.sm },

  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  retailer: { fontSize: 15, fontWeight: "700", color: colors.ink },
  headline: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2, lineHeight: 18 },

  whyLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: spacing.sm,
  },
  why: { fontSize: 13, color: colors.ink, lineHeight: 19 },

  measurements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  measurement: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 100,
  },
  measurementLabel: { fontSize: 10.5, color: colors.inkMuted },
  measurementValue: { fontSize: 13, fontWeight: "700", color: colors.ink, marginTop: 2 },
});
