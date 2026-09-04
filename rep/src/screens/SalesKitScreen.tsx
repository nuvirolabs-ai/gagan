import React, { useCallback, useState } from "react";
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { repApi } from "../api/repClient";
import { AppScreen, EmptyState, ScreenHeader, SectionHeader, Skeleton, StatusChip, Surface } from "../components/ui";
import { colors, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";

const ICONS: Record<string, string> = { pdf: "PDF", image: "IMAGE", video: "VIDEO", link: "LINK" };

export default function SalesKitScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await repApi.salesKit();
    setItems(result.items ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => setItems([])).finally(() => setLoading(false));
    }, [load])
  );

  const open = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert("Could not open this item", "Try again when you have a connection."));
  };

  return (
    <AppScreen>
      <ScreenHeader title="Sales Kit" subtitle="Approved material for retailer conversations" />
      {loading ? (
        <View style={styles.loading}><Skeleton height={88} /><Skeleton height={88} /><Skeleton height={88} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load().catch(() => undefined); setRefreshing(false); }} tintColor={colors.primary} />}
        >
          <Surface style={styles.intro}>
            <Text style={styles.eyebrow}>FIELD COMPANION</Text>
            <Text style={styles.introTitle}>Keep the right story close.</Text>
            <Text style={styles.introBody}>Open a catalogue, scheme sheet or product story while you are with a store owner.</Text>
            <StatusChip label="Read only" tone="neutral" />
          </Surface>
          {items.length === 0 ? <EmptyState icon="folder-open-outline" title="No kit items yet" body="Approved collateral will appear here when it is published." /> : null}
          {Object.entries(items.reduce<Record<string, any[]>>((groups, item) => { (groups[item.category] ??= []).push(item); return groups; }, {})).map(([category, categoryItems]) => (
            <View key={category}>
              <SectionHeader title={category} />
              <Surface>
                {categoryItems.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.type}><Text style={styles.typeText}>{ICONS[item.type] ?? "FILE"}</Text></View>
                    <View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.description}>{item.description}</Text></View>
                    <Text style={styles.open} onPress={() => open(item.url)}>Open</Text>
                  </View>
                ))}
              </Surface>
            </View>
          ))}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingHorizontal: spacing.xl, gap: spacing.md },
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP },
  intro: { gap: spacing.sm },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, color: colors.goldStrong },
  introTitle: { fontSize: 21, fontWeight: "600", color: colors.ink },
  introBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.separator },
  type: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" },
  typeText: { fontSize: 9, fontWeight: "700", color: colors.goldStrong },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: "600", color: colors.ink },
  description: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  open: { fontSize: 13, fontWeight: "600", color: colors.primary },
});
