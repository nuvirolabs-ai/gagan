import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenHeader, EmptyState } from "../components/ui";
import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, radius, spacing, TAB_BAR_SPACE, shadow } from "../theme";
import type { StockHubItem, StockHubPayload } from "../types/home";

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "available") return t("stock.available");
  if (status === "low") return t("stock.low");
  if (status === "stale") return t("stock.stale");
  if (status === "unavailable") return t("stock.unavailable");
  return t("stock.unknown");
}

export default function StockHubScreen({ navigation }: any) {
  const { t } = useLanguage();
  const [data, setData] = useState<StockHubPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      repApi.stock()
        .then((res) => setData(res))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("tabs.stock")} subtitle={t("stock.subtitle")} />
      <View style={styles.note}>
        <Text style={styles.noteText}>{t("stock.honest")}</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.sky} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon="cube-outline" title={t("stock.emptyTitle")} body={t("stock.emptyBody")} />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.productId}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}
          renderItem={({ item }: { item: StockHubItem }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Retailers")}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.category} · {item.availability.warehouseCode}</Text>
              </View>
              <View style={styles.qty}>
                <Text style={styles.qtyValue}>{item.availability.available ?? "—"}</Text>
                <Text style={styles.qtyLabel}>{statusLabel(item.availability.status, t)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  note: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noteText: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.inkMuted, marginTop: 3 },
  qty: { alignItems: "flex-end" },
  qtyValue: { fontSize: 16, fontWeight: "800", color: colors.navy },
  qtyLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: "700", marginTop: 2 },
});
