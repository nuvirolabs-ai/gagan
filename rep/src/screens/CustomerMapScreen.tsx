import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Banner, EmptyState, SearchBar, SecondaryButton, Tag } from "../components/ui";
import { openDirections } from "./RouteScreen";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { colors, inr, radius, shadow, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

function distanceLabel(meters: number | null): string | null {
  if (meters == null) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

/**
 * Assigned customers by location.
 *
 * The payload is plain coordinates and a geotag state, so this screen is
 * deliberately map-provider neutral: it sorts by real distance, shows which
 * stores still have no saved location, and hands directions to whichever maps
 * app the phone already has. No paid map SDK or API key is involved.
 */
export default function CustomerMapScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);

  const load = useCallback(
    async (from?: { latitude: number; longitude: number } | null) => {
      try {
        setData(await repApi.customerMap(from ?? undefined));
      } catch {
        setData(null);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(origin).finally(() => setLoading(false));
    }, [load, origin])
  );

  const sortByDistance = async () => {
    setLocating(true);
    const reading = await captureForegroundLocation();
    setLocating(false);
    if (reading.kind !== "captured") return;
    const next = { latitude: reading.latitude, longitude: reading.longitude };
    setOrigin(next);
    await load(next);
  };

  const visible = useMemo(() => {
    const customers: any[] = data?.customers ?? [];
    const search = query.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(search) ||
        customer.shopAddress.toLowerCase().includes(search)
    );
  }, [data, query]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!data || data.customers.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="map-marker-off-outline" title={t("map.emptyTitle")} body={t("map.emptyBody")} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Banner
          tone={data.missingGeotag > 0 ? "attention" : "active"}
          title={t("map.geotagged", { count: data.geotagged, total: data.customers.length })}
          body={
            data.missingGeotag > 0
              ? `${data.missingGeotag} store${data.missingGeotag === 1 ? " has" : "s have"} no saved location. Open the store while you are there to capture it.`
              : undefined
          }
          icon="location-outline"
        />
        <SecondaryButton
          label={origin ? "Sorted by distance from you" : t("map.nearMe")}
          icon="locate-outline"
          disabled={locating}
          onPress={() => void sortByDistance()}
        />
      </View>

      <SearchBar value={query} onChange={setQuery} placeholder={t("retailers.search")} />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("RepRetailerDetail", { retailerId: item.id })}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.pin,
                  item.latitude == null && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name={item.latitude == null ? "help-outline" : "location"}
                  size={16}
                  color={item.latitude == null ? colors.inkFaint : colors.green}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {item.shopAddress}
                </Text>
              </View>
              {item.latitude == null ? (
                <Tag label={t("map.needsGeotag")} tone="gold" />
              ) : item.distanceMeters != null ? (
                <Text style={styles.distance}>{distanceLabel(item.distanceMeters)}</Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              {item.overdue > 0 ? (
                <Text style={styles.overdue}>{inr(item.overdue)} overdue</Text>
              ) : (
                <Text style={styles.sub}>No overdue amount</Text>
              )}
              {item.latitude != null ? (
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => openDirections(item)}
                  accessibilityLabel={`Directions to ${item.name}`}
                >
                  <Ionicons name="navigate-outline" size={14} color={colors.green} />
                  <Text style={styles.navText}>{t("route.navigate")}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  head: { padding: spacing.lg, gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.card,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pin: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.inkMuted, marginTop: 2, lineHeight: 17 },
  distance: { fontSize: 12.5, fontWeight: "700", color: colors.green },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  overdue: { fontSize: 12.5, fontWeight: "700", color: colors.danger },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  navText: { fontSize: 12.5, fontWeight: "700", color: colors.green },
});
