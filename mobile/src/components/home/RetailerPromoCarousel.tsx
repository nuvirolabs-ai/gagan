import React, { useState } from "react";
import {
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { RetailerPromotion } from "../../lib/retailerPromotions";
import { colors, radius, shadow, spacing } from "../../theme";

const ICONS = {
  leaf: "leaf-outline",
  sparkles: "sparkles-outline",
  nutrition: "nutrition-outline",
} as const;

export default function RetailerPromoCarousel({
  promotions,
  onPress,
}: {
  promotions: RetailerPromotion[];
  onPress: (promotion: RetailerPromotion) => void;
}) {
  const width = useWindowDimensions().width;
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = Math.max(width - spacing.lg * 2, 280);

  if (promotions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={promotions}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + spacing.md));
          setActiveIndex(Math.max(0, Math.min(index, promotions.length - 1)));
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { width: cardWidth }]}
            activeOpacity={0.9}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.cta}`}
          >
            <View style={styles.copy}>
              <View style={styles.eyebrowRow}>
                <Ionicons name={ICONS[item.icon]} size={14} color={colors.accentStrong} />
                <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.detail} numberOfLines={2}>
                {item.detail}
              </Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{item.cta}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.onAccent} />
              </View>
            </View>
            <View style={[styles.visual, !item.imageUrl && styles.visualCategory]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" />
              ) : (
                <>
                  <Ionicons name={ICONS[item.icon]} size={42} color={colors.green} />
                  <Text style={styles.visualLabel}>{item.category}</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
      <View style={styles.dots} accessibilityLabel={`Promotion ${activeIndex + 1} of ${promotions.length}`}>
        {promotions.map((item, index) => (
          <View key={item.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: {
    minHeight: 156,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  copy: { flex: 1, minWidth: 0, paddingVertical: spacing.xs },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrow: { color: colors.accentStrong, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  title: { color: colors.greenDeep, fontSize: 18, lineHeight: 23, fontWeight: "800", marginTop: 6 },
  detail: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 17, fontWeight: "600", marginTop: 4 },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentPrimary,
  },
  ctaText: { color: colors.onAccent, fontSize: 12, fontWeight: "800" },
  visual: { width: 112, height: 128, alignItems: "center", justifyContent: "center" },
  visualCategory: { borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.42)", marginLeft: spacing.sm },
  image: { width: 108, height: 124 },
  visualLabel: { color: colors.green, fontSize: 11, fontWeight: "800", marginTop: spacing.sm },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, paddingTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.track },
  dotActive: { width: 18, backgroundColor: colors.green, borderRadius: 999 },
});
