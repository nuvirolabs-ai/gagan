import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import ProductThumb from "../ProductThumb";
import type { HeroModel } from "../../lib/homePresentation";
import { colors, radius, spacing } from "../../theme";
import { useLanguage } from "../../i18n/LanguageContext";

export default function HomeHero({
  hero,
  onPress,
}: {
  hero: HeroModel;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const narrow = useWindowDimensions().width < 360;
  const cta = hero.cta === "order" ? t("home.viewOrder") : t("home.shopNow");

  return (
    <TouchableOpacity
      style={[styles.hero, narrow && styles.heroNarrow]}
      onPress={onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${hero.kicker}. ${hero.title}. ${cta}`}
    >
      <View style={styles.copy}>
        <Text style={styles.kicker} numberOfLines={1}>
          {hero.kicker}
        </Text>
        <Text style={styles.title} numberOfLines={3}>
          {hero.title}
        </Text>
        {hero.kind === "scheme" && hero.progressPct != null ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${hero.progressPct}%` }]} />
          </View>
        ) : null}
        {hero.foot ? (
          <Text style={styles.foot} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {hero.foot}
          </Text>
        ) : null}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{cta}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.onAccent} />
        </View>
      </View>
      {hero.imageUrl ? (
        <View style={styles.photo}>
          <ProductThumb name={hero.title} category={hero.kicker} imageUrl={hero.imageUrl} size={narrow ? 88 : 108} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 148,
    gap: spacing.md,
    overflow: "hidden",
  },
  heroNarrow: { minHeight: 132, paddingVertical: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: colors.accentStrong,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.greenDeep,
    marginTop: 6,
    lineHeight: 24,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(22,36,27,0.10)",
    overflow: "hidden",
    marginTop: spacing.md,
  },
  fill: { height: "100%", backgroundColor: colors.green, borderRadius: 3 },
  foot: { fontSize: 13, fontWeight: "600", color: colors.ink, marginTop: spacing.sm },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: spacing.md,
    minHeight: 36,
  },
  ctaText: { fontSize: 12.5, fontWeight: "800", color: colors.onAccent },
  photo: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
});
