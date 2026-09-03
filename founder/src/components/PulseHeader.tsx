import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, type as typeScale } from "../theme";

export function PulseHeader({
  brand,
  title,
  rightTop,
  rightBottom,
}: {
  brand: string;
  title: string;
  rightTop?: string;
  rightBottom?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={typeScale.brand}>{brand}</Text>
        <Text style={typeScale.display}>{title}</Text>
      </View>
      {rightTop || rightBottom ? (
        <View style={styles.right}>
          {rightTop ? <Text style={styles.top}>{rightTop}</Text> : null}
          {rightBottom ? <Text style={typeScale.meta}>{rightBottom}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: spacing.md },
  right: { alignItems: "flex-end", paddingTop: 4, maxWidth: "46%" },
  top: { ...typeScale.meta, color: colors.muted, textAlign: "right" },
});
