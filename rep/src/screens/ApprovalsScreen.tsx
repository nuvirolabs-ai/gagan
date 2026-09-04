import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenHeader, EmptyState, TactilePressable } from "../components/ui";
import { repApi } from "../api/repClient";
import { colors, elevation, inr, radius, spacing } from "../theme";
import { SCREEN_CONTENT_BOTTOM_GAP } from "../layout/viewportPolicy";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { useLanguage } from "../i18n/LanguageContext";

type QueueItem = {
  id: string;
  retailer: { name: string };
  order?: { orderNo: number; orderTotal: number | string } | null;
  assessment: { reasons: string[]; projectedExposure: number | string };
  status: string;
};

const label = (code: string) => ({
  new_customer_second_invoice: "Second invoice",
  new_customer_third_invoice: "Third invoice",
  new_customer_50000_cap: "₹50,000 cap",
  so_price_list_variation: "Price variation",
  previous_invoice_pending: "Previous invoice pending",
  one_or_more_outstanding: "Outstanding invoices",
  repeated_monthly_approval: "Repeated approval",
}[code] ?? code.replaceAll("_", " "));

export default function ApprovalsScreen({ navigation }: any) {
  const { staff } = useRep();
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await repApi.approvals();
      setItems(result.requests);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("approvals.title")} subtitle={t("approvals.subtitle")} right={capabilities.canReviewRatings ? <TactilePressable onPress={() => navigation.navigate("RatingReviews")} style={styles.reviewButton}><Text style={styles.reviewLink}>{t("approvals.ratingReviews")}</Text></TactilePressable> : undefined} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : items.length === 0 ? (
        <EmptyState icon="check-decagram-outline" title={t("approvals.title")} body={t("approvals.subtitle")} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TactilePressable style={styles.card} onPress={() => navigation.navigate("ApprovalDetail", { approvalId: item.id })}>
              <View style={styles.between}>
                <View style={styles.grow}>
                  <Text style={styles.name}>{item.retailer.name}</Text>
                  <Text style={styles.meta}>Order #{item.order?.orderNo} · {item.status === "rejected" ? "Rejected · dispute available" : label(item.assessment.reasons[0])}</Text>
                </View>
                <Text style={styles.amount}>{inr(Number(item.order?.orderTotal ?? 0))}</Text>
              </View>
              <Text style={styles.exposure}>{inr(Number(item.assessment.projectedExposure))} projected exposure</Text>
            </TactilePressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loader: { marginTop: spacing.xxl },
  list: { padding: spacing.lg, paddingBottom: SCREEN_CONTENT_BOTTOM_GAP, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, ...elevation.card },
  between: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  name: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.inkMuted, fontSize: 12.5, marginTop: 4, textTransform: "capitalize" },
  amount: { color: colors.ink, fontWeight: "800" },
  exposure: { color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: spacing.md },
  error: { color: colors.danger, marginHorizontal: spacing.lg },
  reviewButton: { minHeight: 44, justifyContent: "center" },
  reviewLink: { color: colors.primary, fontWeight: "700" },
});
