import React from "react";
import { View, StyleSheet } from "react-native";
import { colors, radius, spacing, TAB_BAR_SPACE } from "../../theme";

function Bone({
  width,
  height,
  radius: r = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: colors.surfaceAlt,
        },
        style,
      ]}
    />
  );
}

/** First-frame Home placeholder. No rupee amounts, no stretched blocks. */
export default function HomeSkeleton({ top }: { top: number }) {
  return (
    <View style={[styles.screen, { paddingTop: top }]} accessibilityLabel="Loading home">
      <View style={styles.pad}>
        <Bone width={72} height={10} />
        <Bone width="78%" height={22} style={{ marginTop: 10 }} />
        <Bone width="55%" height={14} style={{ marginTop: 8 }} />
      </View>
      <View style={[styles.search, styles.mx]} />
      <View style={[styles.hero, styles.mx]} />
      <View style={[styles.strip, styles.mx]}>
        <Bone width={64} height={12} />
        <Bone width={64} height={12} />
        <Bone width={64} height={12} />
      </View>
      <View style={styles.pad}>
        <Bone width={120} height={14} />
        <Bone width="100%" height={18} style={{ marginTop: 14 }} />
        <Bone width="92%" height={18} style={{ marginTop: 10 }} />
      </View>
      <View style={[styles.pills, styles.mx]}>
        <Bone width={64} height={32} radius={999} />
        <Bone width={56} height={32} radius={999} />
        <Bone width={52} height={32} radius={999} />
        <Bone width={60} height={32} radius={999} />
      </View>
      <View style={[styles.featured, styles.mx]} />
      <View style={[styles.row, styles.mx]} />
      <View style={[styles.row, styles.mx]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingBottom: TAB_BAR_SPACE },
  pad: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  mx: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  search: { height: 44, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  hero: { height: 148, borderRadius: radius.lg, backgroundColor: colors.cream },
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  pills: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  featured: { height: 132, borderRadius: radius.lg, backgroundColor: colors.cream },
  row: { height: 72, borderRadius: radius.md, backgroundColor: colors.surface },
});
