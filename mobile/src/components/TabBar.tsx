import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, shadow, spacing } from "../theme";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

const ICONS: Record<string, { on: string; off: string; label: string }> = {
  Home: { on: "home", off: "home-outline", label: "Home" },
  Products: { on: "grid", off: "grid-outline", label: "Products" },
  Orders: { on: "receipt", off: "receipt-outline", label: "Orders" },
  Account: { on: "person", off: "person-outline", label: "Account" },
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { lines } = useCart();
  const { t } = useLanguage();
  const cartCount = lines.reduce((n, l) => n + l.qty, 0);

  const cartRoute = state.routes.find((r) => r.name === "Cart");
  const sideRoutes = state.routes.filter((r) => r.name !== "Cart");
  const left = sideRoutes.slice(0, 2);
  const right = sideRoutes.slice(2);

  const go = (name: string) => {
    const target = state.routes.find((r) => r.name === name);
    const isFocused = state.routes[state.index]?.name === name;
    if (!target) return;
    const event = navigation.emit({ type: "tabPress", target: target.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(name);
  };

  const renderTab = (name: string) => {
    const meta = ICONS[name];
    if (!meta) return null;
    const focused = state.routes[state.index]?.name === name;
    return (
      <TouchableOpacity key={name} style={styles.tab} onPress={() => go(name)} accessibilityRole="tab">
        <Ionicons
          name={(focused ? meta.on : meta.off) as any}
          size={21}
          color={focused ? colors.green : colors.inkFaint}
        />
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{t(`tabs.${name.toLowerCase()}`)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar}>
        {left.map((r) => renderTab(r.name))}

        {cartRoute && (
          <View style={styles.fabSlot}>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => go("Cart")}
              accessibilityRole="button"
              accessibilityLabel={t("cart.itemCount", { count: cartCount })}
            >
              <Ionicons name="cart-outline" size={24} color={colors.onDark} />
              {cartCount > 0 && (
                <View style={styles.fabBadge}>
                  <Text style={styles.fabBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {right.map((r) => renderTab(r.name))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    backgroundColor: "transparent",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: 10,
    ...shadow.floating,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabLabel: { fontSize: 10, fontWeight: "600", color: colors.inkFaint },
  tabLabelActive: { color: colors.green, fontWeight: "700" },
  fabSlot: { width: 76, alignItems: "center", justifyContent: "center" },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    borderWidth: 4,
    borderColor: colors.bg,
    ...shadow.floating,
  },
  fabBadge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 21,
    height: 21,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  fabBadgeText: { color: colors.onDark, fontSize: 11, fontWeight: "800" },
});
