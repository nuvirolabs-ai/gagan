import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatIsoDay, monthGrid, monthStart, parseIsoDay, shiftMonth } from "./dateHelpers";
import { colors, control, radius, spacing } from "../theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function DatePickerModal({
  visible,
  value,
  title = "Choose a date",
  onChange,
  onClose,
}: {
  visible: boolean;
  value: string;
  title?: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const selected = parseIsoDay(value) ?? new Date();
  const [month, setMonth] = useState(() => monthStart(selected));
  useEffect(() => {
    if (visible) setMonth(monthStart(selected));
  }, [value, visible]);
  const cells = useMemo(() => monthGrid(month), [month]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>{title}</Text>
              <Text style={styles.selected}>{formatIsoDay(value, { weekday: "long", day: "numeric", month: "long" })}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.inkMuted} />
            </Pressable>
          </View>

          <View style={styles.monthHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((current) => shiftMonth(current, -1))} style={styles.arrow}>
              <Ionicons name="chevron-back" size={18} color={colors.ink} />
            </Pressable>
            <Text style={styles.monthTitle}>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth((current) => shiftMonth(current, 1))} style={styles.arrow}>
              <Ionicons name="chevron-forward" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>{WEEKDAYS.map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.grid}>
            {cells.map((day, index) => {
              const active = day === value;
              return day ? (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={formatIsoDay(day, { weekday: "long", day: "numeric", month: "long" })}
                  onPress={() => { onChange(day); onClose(); }}
                  style={[styles.day, active && styles.dayActive]}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{Number(day.slice(-2))}</Text>
                </Pressable>
              ) : <View key={`empty-${index}`} style={styles.day} />;
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={() => { const today = new Date().toISOString().slice(0, 10); onChange(today); onClose(); }} style={styles.todayButton}>
            <Text style={styles.todayText}>Use today</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.38)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: { color: colors.inkMuted, fontSize: 12, fontWeight: "600" },
  selected: { color: colors.ink, fontSize: 18, fontWeight: "700", marginTop: 4 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: control.minTap, height: control.minTap, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  monthTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", color: colors.inkFaint, fontSize: 11, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm },
  day: { width: "14.2857%", height: 40, alignItems: "center", justifyContent: "center" },
  dayActive: { backgroundColor: colors.primary, borderRadius: radius.pill },
  dayText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  dayTextActive: { color: colors.onDark },
  todayButton: { alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  todayText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});
