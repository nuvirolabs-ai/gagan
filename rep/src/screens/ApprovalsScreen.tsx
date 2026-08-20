import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ScreenHeader, EmptyState } from "../components/ui";
import { repApi } from "../api/repClient";
import { colors, inr, radius, spacing } from "../theme";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";

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
      <ScreenHeader title="Approvals" subtitle="Orders waiting for your decision" right={capabilities.canReviewRatings ? <TouchableOpacity onPress={() => navigation.navigate("RatingReviews")}><Text style={styles.reviewLink}>Rating reviews</Text></TouchableOpacity> : undefined} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={styles.loader} color={colors.green} /> : items.length === 0 ? (
        <EmptyState icon="check-decagram-outline" title="Queue is clear" body="No orders need your approval." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ApprovalDetail", { approvalId: item.id })}>
              <View style={styles.between}>
                <View style={styles.grow}>
                  <Text style={styles.name}>{item.retailer.name}</Text>
                  <Text style={styles.meta}>Order #{item.order?.orderNo} · {item.status === "rejected" ? "Rejected · dispute available" : label(item.assessment.reasons[0])}</Text>
                </View>
                <Text style={styles.amount}>{inr(Number(item.order?.orderTotal ?? 0))}</Text>
              </View>
              <Text style={styles.exposure}>{inr(Number(item.assessment.projectedExposure))} projected exposure</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loader: { marginTop: spacing.xxl },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  between: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grow: { flex: 1 },
  name: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.inkMuted, fontSize: 12.5, marginTop: 4, textTransform: "capitalize" },
  amount: { color: colors.ink, fontWeight: "800" },
  exposure: { color: colors.green, fontSize: 12, fontWeight: "700", marginTop: spacing.md },
  error: { color: colors.danger, marginHorizontal: spacing.lg },
  reviewLink: { color: colors.green, fontWeight: "700", paddingBottom: 3 },
});
