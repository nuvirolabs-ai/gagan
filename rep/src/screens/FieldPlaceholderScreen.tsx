import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme";

export default function FieldPlaceholderScreen({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="information-circle-outline" size={26} color={colors.sky} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.inkMuted, lineHeight: 20, marginTop: spacing.sm },
});
