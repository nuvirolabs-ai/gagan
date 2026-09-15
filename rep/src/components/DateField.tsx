import React, { useState } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatDateOnly, isDateWithinBounds, localDayKey, monthCells, monthLabel, parseDateOnly } from "../dateOnly";
import { colors, control, elevation, radius, spacing } from "../theme";

export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  error?: string;
  testID?: string;
};

function monthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthKey(value: Date): number {
  return value.getFullYear() * 12 + value.getMonth();
}

/**
 * Date-only input for field forms. It is intentionally a button rather than a
 * TextInput, so choosing a date never opens the software keyboard or accepts
 * a malformed hand-entered date.
 */
export function DateField({ label, value, onChange, minDate, maxDate, disabled = false, error, testID }: DateFieldProps) {
  const selected = parseDateOnly(value) ?? parseDateOnly(localDayKey())!;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => monthStart(selected));
  const cells = monthCells(cursor);
  const minMonth = minDate ? parseDateOnly(minDate) : null;
  const maxMonth = maxDate ? parseDateOnly(maxDate) : null;

  const openCalendar = () => {
    if (disabled) return;
    Keyboard.dismiss();
    setCursor(monthStart(parseDateOnly(value) ?? parseDateOnly(localDayKey())!));
    setOpen(true);
  };

  const choose = (day: string) => {
    if (!isDateWithinBounds(day, minDate, maxDate)) return;
    onChange(day);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDateOnly(value) || "not selected"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openCalendar}
        style={({ pressed }) => [styles.field, disabled && styles.disabled, pressed && !disabled && styles.pressed, error && styles.errorField]}
      >
        <View style={styles.fieldCopy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatDateOnly(value) : "Select a date"}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        <Ionicons name="calendar-outline" size={control.iconMd} color={disabled ? colors.inkFaint : colors.blueInk} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogHeading}>
                <Text style={styles.dialogKicker}>CHOOSE DATE</Text>
                <Text style={styles.dialogTitle}>{label}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close calendar" onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={styles.close}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                disabled={Boolean(minMonth && monthKey(cursor) <= monthKey(minMonth))}
                onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={20} color={colors.inkMuted} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel(cursor)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                disabled={Boolean(maxMonth && monthKey(cursor) >= monthKey(maxMonth))}
                onPress={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.inkMuted} />
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekLabel}>{day}</Text>)}
            </View>
            <View style={styles.calendarGrid}>
              {cells.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={styles.calendarDay} />;
                const unavailable = !isDateWithinBounds(day, minDate, maxDate);
                const isSelected = day === value;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} ${day}`}
                    accessibilityState={{ selected: isSelected, disabled: unavailable }}
                    disabled={unavailable}
                    onPress={() => choose(day)}
                    style={({ pressed }) => [styles.calendarDay, isSelected && styles.selectedDay, unavailable && styles.unavailableDay, pressed && !unavailable && styles.pressed]}
                  >
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText, unavailable && styles.unavailableText]}>{Number(day.slice(-2))}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 70, flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  fieldCopy: { flex: 1 },
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 4 },
  placeholder: { color: colors.inkFaint },
  disabled: { opacity: 0.55 },
  errorField: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 4 },
  overlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.46)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  dialog: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, ...elevation.floating },
  dialogHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: spacing.xl },
  dialogHeading: { flex: 1 },
  dialogKicker: { color: colors.blueInk, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  dialogTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", marginTop: 4 },
  close: { color: colors.blueInk, fontSize: 14, fontWeight: "700" },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  monthButton: { minWidth: control.minTap, minHeight: control.minTap, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  monthTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginBottom: spacing.xs },
  weekLabel: { flex: 1, textAlign: "center", color: colors.inkFaint, fontSize: 11, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: { width: `${100 / 7}%`, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  selectedDay: { backgroundColor: colors.blue },
  unavailableDay: { opacity: 0.36 },
  dayText: { color: colors.ink, fontSize: 14 },
  selectedDayText: { color: colors.onDark, fontWeight: "800" },
  unavailableText: { color: colors.inkFaint },
  pressed: { opacity: 0.72 },
});
