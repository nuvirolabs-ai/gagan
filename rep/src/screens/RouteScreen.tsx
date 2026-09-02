import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  AppScreen,
  Card,
  EmptyState,
  Field,
  PrimaryButton,
  ProgressTrack,
  SecondaryButton,
  Tag,
  inputStyle,
} from "../components/ui";
import { repApi } from "../api/repClient";
import { colors, radius, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const STOP_TONE: Record<string, "green" | "neutral" | "gold"> = {
  visited: "green",
  skipped: "neutral",
  pending: "gold",
};

const PURPOSE_LABELS: Record<string, string> = {
  sales_call: "Sales call",
  collection: "Collection",
  service: "Service",
  onboarding: "Onboarding",
  merchandising: "Merchandising",
  other: "Other",
};

export function openDirections(retailer: {
  latitude: number | null;
  longitude: number | null;
  name: string;
}) {
  if (retailer.latitude == null || retailer.longitude == null) {
    Alert.alert(
      "No saved location",
      "This store has no saved location yet. Capture it from the store page while you are there."
    );
    return;
  }
  // The phone's own maps app handles directions, so the app carries no map
  // provider key or billing of its own.
  const geo = `geo:${retailer.latitude},${retailer.longitude}?q=${retailer.latitude},${retailer.longitude}(${encodeURIComponent(retailer.name)})`;
  Linking.openURL(geo).catch(() =>
    Linking.openURL(`https://maps.google.com/?q=${retailer.latitude},${retailer.longitude}`).catch(
      () => Alert.alert("No maps app", "This phone has no app that can open directions.")
    )
  );
}

export default function RouteScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [route, setRoute] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [skippingStopId, setSkippingStopId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await repApi.route();
      setRoute(response.route);
    } catch {
      setRoute(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const submitSkip = async (stopId: string) => {
    if (skipReason.trim().length < 3) {
      return Alert.alert("Add a reason", "Tell your manager why this stop was not covered.");
    }
    try {
      await repApi.skipRouteStop(stopId, skipReason.trim());
      setSkippingStopId(null);
      setSkipReason("");
      await load();
    } catch (error: any) {
      Alert.alert(
        "Could not skip this stop",
        error?.message === "route_stop_already_settled"
          ? "This stop has already been visited or skipped."
          : "Try again when you have a connection."
      );
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  if (!route) {
    return (
      <AppScreen>
        <EmptyState
          icon="map-marker-path"
          title={t("route.emptyTitle")}
          body={t("today.noRoutePublished")}
        />
      </AppScreen>
    );
  }

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
        <Card>
          <Text style={styles.title}>{route.name ?? t("route.title")}</Text>
          <Text style={styles.muted}>
            {t("route.stopsDone", {
              done: route.progress.visited + route.progress.skipped,
              total: route.progress.total,
            })}
          </Text>
          <ProgressTrack pct={route.progress.completionPct} />
        </Card>

        {route.stops.map((stop: any) => (
          <Card key={stop.id}>
            <View style={styles.stopHead}>
              <View style={styles.sequence}>
                <Text style={styles.sequenceText}>{stop.sequence}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName} numberOfLines={2}>
                  {stop.retailer.name}
                </Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {stop.retailer.shopAddress}
                </Text>
              </View>
              <Tag
                label={
                  stop.status === "visited"
                    ? t("route.visited")
                    : stop.status === "skipped"
                      ? t("route.skipped")
                      : t("route.pending")
                }
                tone={STOP_TONE[stop.status] ?? "neutral"}
              />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.meta}>{PURPOSE_LABELS[stop.purpose] ?? stop.purpose}</Text>
              {stop.retailer.locationStatus !== "VERIFIED" ? (
                <Text style={styles.metaWarn}>{t("map.needsGeotag")}</Text>
              ) : null}
            </View>
            {stop.note ? <Text style={styles.note}>{stop.note}</Text> : null}
            {stop.skipReason ? (
              <Text style={styles.note}>{t("route.skipped")}: {stop.skipReason}</Text>
            ) : null}

            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Open store"
                  icon="storefront-outline"
                  onPress={() =>
                    navigation.navigate("RepRetailerDetail", { retailerId: stop.retailer.id })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={t("route.navigate")}
                  icon="navigate-outline"
                  onPress={() => openDirections(stop.retailer)}
                />
              </View>
            </View>

            {stop.status === "pending" ? (
              skippingStopId === stop.id ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  <Field label={t("route.skipReason")}>
                    <TextInput
                      value={skipReason}
                      onChangeText={setSkipReason}
                      placeholder="Shop closed, owner unavailable…"
                      placeholderTextColor={colors.inkFaint}
                      style={inputStyle}
                      multiline
                    />
                  </Field>
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}>
                      <SecondaryButton
                        label={t("common.cancel")}
                        onPress={() => {
                          setSkippingStopId(null);
                          setSkipReason("");
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label={t("route.skip")}
                        onPress={() => void submitSkip(stop.id)}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <SecondaryButton
                  label={t("route.skip")}
                  icon="close-circle-outline"
                  onPress={() => setSkippingStopId(stop.id)}
                />
              )
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },

  stopHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sequence: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sequenceText: { fontSize: 13, fontWeight: "800", color: colors.green },
  stopName: { fontSize: 15, fontWeight: "700", color: colors.ink },

  metaRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
  meta: { fontSize: 11.5, fontWeight: "700", color: colors.inkMuted },
  metaWarn: { fontSize: 11.5, fontWeight: "700", color: colors.gold },
  note: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },

  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
});
