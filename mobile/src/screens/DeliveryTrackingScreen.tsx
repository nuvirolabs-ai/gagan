import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { api } from "../api/client";
import { EmptyState } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, spacing } from "../theme";

const STEPS = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"] as const;

export default function DeliveryTrackingScreen({ route }: any) {
  const { t } = useLanguage();
  const { orderId } = route.params;
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDeliveryStatus(orderId);
      setStatus(res.status);
      setLoadError(false);
    } catch {
      setStatus(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="alert-circle-outline"
          title={t("tracking.loadError")}
          body={t("errors.checkConnection")}
          actionLabel={t("common.retry")}
          onAction={() => void load()}
        />
      </View>
    );
  }

  if (status === "rejected") {
    return (
      <View style={styles.center}>
        <Text style={styles.rejected}>{t("status.rejected")}</Text>
        <Text style={styles.hint}>{t("profile.support")}</Text>
      </View>
    );
  }

  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => (
        <View key={step} style={styles.stepRow}>
          <View style={[styles.dot, i <= currentIndex && styles.dotActive]} />
          <Text style={[styles.stepLabel, i <= currentIndex && styles.stepLabelActive]}>
            {t(`status.${step}`)}
          </Text>
          {i < STEPS.length - 1 && <View style={[styles.line, i < currentIndex && styles.lineActive]} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, backgroundColor: colors.bg },
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.bg },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, minHeight: 44 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.track },
  dotActive: { backgroundColor: colors.green },
  stepLabel: { marginLeft: 12, fontSize: 16, color: colors.inkMuted },
  stepLabelActive: { color: colors.green, fontWeight: "600" },
  line: {
    width: 2,
    height: 24,
    backgroundColor: colors.track,
    marginLeft: 7,
    position: "absolute",
    top: 20,
  },
  lineActive: { backgroundColor: colors.green },
  rejected: { fontSize: 16, color: colors.danger, fontWeight: "600" },
  hint: { color: colors.inkMuted, marginTop: 8 },
});
