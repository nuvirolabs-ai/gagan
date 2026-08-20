import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, radius } from "../theme";

// Product photography isn't wired up yet (no imageUrl on seeded SKUs), so this
// renders a branded pack stand-in keyed to the category. Swap in <Image> once
// real assets land — the shape and sizing stay the same.
const CATEGORY_TINT: Record<string, { bg: string; band: string }> = {
  Pulses: { bg: "#F5D98E", band: "#D9A62B" },
  Rice: { bg: "#DCE9DA", band: "#2E6B47" },
  Staples: { bg: "#D8E3F0", band: "#2F5B8F" },
};

export default function ProductThumb({
  name,
  category,
  imageUrl,
  size = 92,
}: {
  name: string;
  category: string;
  imageUrl?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: radius.sm }} />;
  }

  const tint = CATEGORY_TINT[category] ?? { bg: colors.surfaceAlt, band: colors.green };

  return (
    <View style={[styles.pack, { width: size, height: size, backgroundColor: tint.bg }]}>
      <View style={[styles.band, { backgroundColor: tint.band }]}>
        <Text style={styles.brand}>GAGAN</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pack: {
    borderRadius: radius.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  band: {
    width: "100%",
    paddingVertical: 4,
    alignItems: "center",
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  name: {
    marginTop: 8,
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#3A2E12",
    textAlign: "center",
  },
});
