import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, inr, radius, shadow, spacing } from "../theme";
import { getMiniCartModel } from "../lib/miniCart";

export default function MiniCartBar({ onPress }: { onPress: () => void }) {
  const { lines, total } = useCart();
  const { t } = useLanguage();
  const model = getMiniCartModel(lines, total);
  if (!model.visible) return null;

  return (
    <TouchableOpacity
      style={styles.miniCart}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${t("cart.itemCount", { count: model.itemCount })}. ${t("cart.catalogueSubtotal")} ${inr(model.subtotal)}. View cart`}
    >
      <View style={styles.icon}>
        <Ionicons name="cart-outline" size={19} color={colors.onDark} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.count}>{t("cart.itemCount", { count: model.itemCount })}</Text>
        <Text style={styles.label}>{t("cart.catalogueSubtotal")}</Text>
      </View>
      <Text style={styles.amount}>{inr(model.subtotal)}</Text>
      <View style={styles.viewCart}>
        <Text style={styles.viewCartText}>View cart</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.greenDeep} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  miniCart: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.green,
    ...shadow.card,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenMid,
  },
  copy: { flex: 1, minWidth: 0 },
  count: { color: colors.onDark, fontSize: 12.5, fontWeight: "800" },
  label: { color: colors.onDarkMuted, fontSize: 10.5, fontWeight: "600", marginTop: 2 },
  amount: { color: colors.onDark, fontSize: 13.5, fontWeight: "800", maxWidth: 92, textAlign: "right" },
  viewCart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentPrimary,
  },
  viewCartText: { color: colors.onAccent, fontSize: 10.5, fontWeight: "800" },
});
