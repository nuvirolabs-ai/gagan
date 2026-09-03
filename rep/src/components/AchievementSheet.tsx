import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing, inr } from "../theme";
import type { SalesHomePayload } from "../types/home";
import { firstName } from "../home/format";

export function AchievementSheet({
  visible,
  home,
  milestone,
  onClose,
}: {
  visible: boolean;
  home: SalesHomePayload | null;
  milestone: number | null;
  onClose: () => void;
}) {
  if (!home || milestone == null) return null;
  const next = home.sales.nextMilestone;
  const first = firstName(home.staff.name);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.title}>Crushing it, {first}</Text>
          <Text style={styles.body}>
            You just hit {milestone}% of today's target
            {next ? `. One more to unlock ${next}%.` : ". Daily target unlocked."}
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{home.route.planned}</Text>
              <Text style={styles.statLabel}>Visits</Text>
            </View>
            <View style={styles.ringWrap}>
              <View style={styles.ring}>
                <Text style={styles.ringValue}>{home.route.done}/{home.sales.dailyPct}%</Text>
              </View>
              <Text style={styles.statLabel}>Done</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{home.route.coveragePct}%</Text>
              <Text style={styles.statLabel}>Coverage</Text>
            </View>
          </View>
          {home.route.stops.slice(0, 2).map((stop) => (
            <View key={stop.id} style={styles.stop}>
              <Text style={styles.stopTime}>{stop.timeLabel}</Text>
              <Text style={styles.stopName}>{stop.name}</Text>
              <Text style={styles.stopStatus}>{stop.status}</Text>
            </View>
          ))}
          <Text style={styles.salesNote}>Today {inr(home.sales.today)} of {inr(home.sales.dailyTarget)}</Text>
          <TouchableOpacity style={styles.keep} onPress={onClose}>
            <Text style={styles.keepText}>Keep going</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 36,
  },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: colors.track, marginBottom: spacing.lg },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  body: { fontSize: 14, color: colors.inkMuted, marginTop: 6, lineHeight: 20 },
  stats: { flexDirection: "row", alignItems: "center", marginVertical: spacing.xl },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 12, color: colors.inkMuted, marginTop: 4, fontWeight: "600" },
  ringWrap: { flex: 1, alignItems: "center" },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    borderColor: colors.sky,
    alignItems: "center",
    justifyContent: "center",
  },
  ringValue: { fontSize: 12, fontWeight: "800", color: colors.navy },
  stop: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 10 },
  stopTime: { width: 48, color: colors.inkMuted, fontWeight: "700", fontSize: 12 },
  stopName: { flex: 1, color: colors.ink, fontWeight: "700" },
  stopStatus: { color: colors.inkMuted, fontWeight: "800", fontSize: 11, letterSpacing: 0.4 },
  salesNote: { color: colors.inkMuted, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  keep: { backgroundColor: colors.sky, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", marginTop: spacing.lg },
  keepText: { color: colors.onDark, fontWeight: "800", fontSize: 16 },
  dismiss: { textAlign: "center", color: colors.inkMuted, fontWeight: "700", marginTop: spacing.md, fontSize: 14 },
});
