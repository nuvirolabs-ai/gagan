import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "../theme";
import { TactilePressable } from "./ui";

/**
 * How the app celebrates.
 *
 * The engine decides *what* was earned and how loudly; this decides what that
 * looks like. There is no confetti, no sound, no streak counter pushing the
 * next thing — a major event gets a warm card, a minor one gets a single line.
 * Nothing here implies a prize, because the product has no reward scheme.
 *
 * The shape is deliberately generic so the Retailer app can present its own
 * milestones with the same primitive rather than inventing a second look.
 */
export interface AchievementLike {
  id: string;
  type: string;
  title: string;
  message: string;
  celebration: "major" | "minor";
}

const ICONS: Record<string, string> = {
  TARGET_50: "trending-up-outline",
  TARGET_75: "trending-up-outline",
  TARGET_90: "trending-up-outline",
  TARGET_100: "trophy-outline",
  TARGET_EXCEEDED: "trophy-outline",
  PERSONAL_BEST: "flame-outline",
  NEW_RETAILER_MILESTONE: "storefront-outline",
  RANK_UP: "arrow-up-circle-outline",
  TOP_10: "ribbon-outline",
  TOP_3: "ribbon-outline",
};

export function AchievementCard({
  achievement,
  onDismiss,
}: {
  achievement: AchievementLike;
  onDismiss?: () => void;
}) {
  const major = achievement.celebration === "major";
  return (
    <View style={[s.card, major ? s.cardMajor : s.cardMinor]}>
      <View style={[s.icon, major ? s.iconMajor : s.iconMinor]}>
        <Ionicons
          name={(ICONS[achievement.type] ?? "sparkles-outline") as any}
          size={major ? 22 : 17}
          // The milestone surface is the one place where the bright lime
          // treatment is intentional; the icon remains dark for contrast.
          color={major ? colors.onAccent : colors.accentStrong}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, major && s.titleMajor]} numberOfLines={2}>
          {achievement.title}
        </Text>
        <Text style={s.message} numberOfLines={3}>
          {achievement.message}
        </Text>
      </View>
      {onDismiss ? (
        <TactilePressable
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={17} color={colors.inkMuted} />
        </TactilePressable>
      ) : null}
    </View>
  );
}

/** A compact line for an event that is worth noting but not stopping for. */
export function AchievementLine({ achievement }: { achievement: AchievementLike }) {
  return (
    <View style={s.line}>
      <Ionicons
        name={(ICONS[achievement.type] ?? "sparkles-outline") as any}
        size={15}
        color={colors.accentStrong}
      />
      <Text style={s.lineText} numberOfLines={2}>
        <Text style={s.lineTitle}>{achievement.title}. </Text>
        {achievement.message}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardMajor: { backgroundColor: colors.limeSoft, borderWidth: 1, borderColor: colors.lime },
  cardMinor: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  icon: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  iconMajor: { backgroundColor: colors.lime },
  iconMinor: { backgroundColor: colors.accentSoft },
  title: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  titleMajor: { fontSize: 16 },
  message: { fontSize: 12.5, color: colors.inkMuted, marginTop: 3, lineHeight: 18 },

  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 6 },
  lineText: { flex: 1, fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
  lineTitle: { color: colors.ink, fontWeight: "700" },
});
