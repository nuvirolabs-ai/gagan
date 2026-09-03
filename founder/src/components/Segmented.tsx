import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Tokens } from "../theme";

export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  colors,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
  colors: Tokens;
}) {
  return (
    <View style={[styles.track, { backgroundColor: colors.fill, borderColor: colors.separator }]}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.item, selected ? { backgroundColor: colors.fill, borderWidth: 1, borderColor: colors.positive } : { borderWidth: 1, borderColor: "transparent" }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, { color: selected ? colors.positive : colors.secondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: 999, padding: 3, borderWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, borderRadius: 999, paddingVertical: 6, alignItems: "center" },
  label: { fontSize: 12, fontWeight: "700" },
});
