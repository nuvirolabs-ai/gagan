import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { tokensFor } from "../theme";
import { useColorScheme } from "react-native";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Pulse: "pulse-outline",
  Trends: "analytics-outline",
  Issues: "alert-circle-outline",
  Decisions: "checkmark-circle-outline",
};

export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = tokensFor(useColorScheme());
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.separator, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? colors.label : colors.tabInactive;
        const label = descriptors[route.key].options.tabBarLabel ?? route.name;
        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
          >
            <Ionicons name={ICONS[route.name] ?? "ellipse-outline"} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{String(label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: 10, fontWeight: "500" },
});
