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
    <View style={[styles.track, { backgroundColor: colors.fill }]}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.item, selected ? { backgroundColor: colors.surface } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, { color: selected ? colors.label : colors.secondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: 9, padding: 2 },
  item: { flex: 1, borderRadius: 7, paddingVertical: 7, alignItems: "center" },
  label: { fontSize: 13, fontWeight: "600" },
});
