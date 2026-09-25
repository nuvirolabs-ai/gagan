import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useLanguage } from "../i18n/LanguageContext";
import { formatOrderRef } from "../lib/orderRef";
import { colors, radius, spacing, inr } from "../theme";

export default function OrderConfirmationScreen({ route, navigation }: any) {
  const { order } = route.params;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.mark}>
        <MaterialCommunityIcons name="check" size={36} color={colors.onDark} />
      </View>
      <Text style={styles.title}>{t("orders.orderPlaced")}</Text>
      <Text style={styles.orderId}>{formatOrderRef(order)}</Text>
      <Text style={styles.total}>{inr(Number(order.orderTotal))}</Text>
      <Text style={styles.hint}>{t("orders.confirmationHint")}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Main", { screen: "Orders" })}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("orders.viewHistory")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.secondary]}
        onPress={() => navigation.navigate("Main", { screen: "Products" })}
        accessibilityRole="button"
      >
        <Text style={[styles.buttonText, styles.secondaryText]}>{t("orders.continueShopping")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  orderId: { fontSize: 14, color: colors.inkMuted, marginTop: 8, fontWeight: "600" },
  total: { fontSize: 22, fontWeight: "700", color: colors.ink, marginTop: 12 },
  hint: { textAlign: "center", color: colors.inkMuted, marginTop: 12, marginBottom: 32, lineHeight: 20 },
  button: {
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    padding: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonText: { color: colors.onDark, fontWeight: "700" },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.green },
  secondaryText: { color: colors.green },
});
