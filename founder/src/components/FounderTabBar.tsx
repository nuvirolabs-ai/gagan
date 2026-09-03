import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, type as typeScale } from "../theme";

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  Today: { on: "apps", off: "apps-outline", label: "Today" },
  Series: { on: "trending-up", off: "trending-up-outline", label: "Series" },
  Queue: { on: "list", off: "list-outline", label: "Queue" },
  You: { on: "ellipse", off: "ellipse-outline", label: "You" },
};

export default function FounderTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const meta = ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
          >
            <Ionicons name={focused ? meta.on : meta.off} size={20} color={focused ? colors.ink : colors.muted} />
            <Text style={[styles.label, focused && styles.labelOn]}>{meta.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  label: { ...typeScale.micro, color: colors.muted },
  labelOn: { color: colors.ink, fontWeight: "700" },
});
