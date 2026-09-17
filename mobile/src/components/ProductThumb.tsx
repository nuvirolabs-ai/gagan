import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";

// Product photography comes from the catalog record when available. The
// category fallback keeps offline/older SAP rows visually usable.
const CATEGORY_TINT: Record<string, { bg: string; band: string }> = {
  Pulses: { bg: "#F5D98E", band: "#D9A62B" },
  Daal: { bg: "#F5D98E", band: "#D9A62B" },
  Rice: { bg: "#DCE9DA", band: "#2E6B47" },
  Staples: { bg: "#D8E3F0", band: "#2F5B8F" },
  Sugar: { bg: "#F8E7BF", band: "#C9992B" },
  Breakfast: { bg: "#F2D6A0", band: "#B8782B" },
};

export default function ProductThumb({
  name,
  category,
  imageUrl,
  imageStatus,
  imageLabel,
  size = 92,
}: {
  name: string;
  category: string;
  imageUrl?: string | null;
  imageStatus?: "exact" | "placeholder" | "pending";
  imageLabel?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        resizeMode="contain"
        style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}
      />
    );
  }

  const tint = CATEGORY_TINT[category] ?? { bg: colors.surfaceAlt, band: colors.green };

  if (imageStatus === "placeholder" || imageStatus === "pending") {
    return (
      <View style={[styles.missing, { width: size, height: size, backgroundColor: tint.bg }]}>
        <Ionicons name="image-outline" size={Math.max(20, size * 0.28)} color={tint.band} />
        <Text style={[styles.missingLabel, { color: tint.band }]} numberOfLines={3}>
          {imageLabel ?? (imageStatus === "placeholder" ? "Image coming soon" : "Image pending confirmation")}
        </Text>
      </View>
    );
  }

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
  missing: {
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 5,
  },
  missingLabel: { fontSize: 10, fontWeight: "800", textAlign: "center", lineHeight: 13 },
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
