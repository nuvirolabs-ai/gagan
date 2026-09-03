import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap; idleColor: string }> = {
  Attendance: { active: "home", idle: "home-outline", idleColor: colors.navy },
  Order: { active: "bag-handle", idle: "bag-handle-outline", idleColor: "#E07A5F" },
  Stock: { active: "cube", idle: "cube-outline", idleColor: colors.sky },
  More: { active: "grid", idle: "grid-outline", idleColor: colors.inkMuted },
};

export function OceanTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? ICONS.More;
          const label = descriptors[route.key]?.options.tabBarLabel;
          const title = typeof label === "string" ? label : route.name;
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={title}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.item}
            >
              <Ionicons
                name={focused ? icon.active : icon.idle}
                size={22}
                color={focused ? colors.navy : icon.idleColor}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>{title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 4 },
  label: { fontSize: 11, fontWeight: "600", color: colors.inkMuted },
  labelActive: { color: colors.navy, fontWeight: "800" },
});

