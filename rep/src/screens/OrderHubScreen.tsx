import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader, EmptyState } from "../components/ui";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, radius, spacing, TAB_BAR_SPACE, shadow } from "../theme";

export default function OrderHubScreen({ navigation }: any) {
  const { staff, setActiveRetailer } = useRep();
  const { t } = useLanguage();
  const canOrder = staffCapabilities(staff?.permissions ?? []).canOrderForRetailers;
  const [retailers, setRetailers] = useState<any[]>([]);
  const [loading, setLoading] = useState(canOrder);

  useFocusEffect(
    useCallback(() => {
      if (!canOrder) return;
      setLoading(true);
      repApi.retailers()
        .then((res) => setRetailers(res.retailers))
        .catch(() => setRetailers([]))
        .finally(() => setLoading(false));
    }, [canOrder])
  );

  const openOrder = (retailer: any) => {
    setActiveRetailer(retailer.id);
    navigation.navigate("RepCatalog", { retailerId: retailer.id, retailerName: retailer.name });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("tabs.order")} subtitle={t("order.subtitle")} />
      {!canOrder ? (
        <EmptyState icon="briefcase-outline" title={t("order.needsSales")} body={t("order.needsSalesBody")} />
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.sky} />
      ) : (
        <FlatList
          data={retailers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          ListEmptyComponent={<EmptyState icon="store-outline" title={t("retailers.title")} body={t("home.routeEmpty")} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openOrder(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{String(item.name).slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.shopAddress ?? item.phone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onDark, fontWeight: "800", fontSize: 12 },
  name: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
});
