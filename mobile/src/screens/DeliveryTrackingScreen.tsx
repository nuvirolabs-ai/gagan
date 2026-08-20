import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../api/client";

const STEPS = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

export default function DeliveryTrackingScreen({ route }: any) {
  const { orderId } = route.params;
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDeliveryStatus(orderId)
      .then((res) => setStatus(res.status))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a5c2e" />
      </View>
    );
  }

  if (status === "rejected") {
    return (
      <View style={styles.center}>
        <Text style={styles.rejected}>This order was rejected.</Text>
        <Text style={styles.hint}>Contact support for details.</Text>
      </View>
    );
  }

  const currentIndex = STEPS.indexOf(status as any);

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => (
        <View key={step} style={styles.stepRow}>
          <View style={[styles.dot, i <= currentIndex && styles.dotActive]} />
          <Text style={[styles.stepLabel, i <= currentIndex && styles.stepLabelActive]}>
            {STEP_LABEL[step]}
          </Text>
          {i < STEPS.length - 1 && <View style={[styles.line, i < currentIndex && styles.lineActive]} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ddd" },
  dotActive: { backgroundColor: "#1a5c2e" },
  stepLabel: { marginLeft: 12, fontSize: 16, color: "#999" },
  stepLabelActive: { color: "#1a5c2e", fontWeight: "600" },
  line: { width: 2, height: 24, backgroundColor: "#ddd", marginLeft: 7, position: "absolute", top: 20 },
  lineActive: { backgroundColor: "#1a5c2e" },
  rejected: { fontSize: 16, color: "#c0392b", fontWeight: "600" },
  hint: { color: "#777", marginTop: 8 },
});
