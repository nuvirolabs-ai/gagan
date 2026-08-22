import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radius, spacing, shadow } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

/** Title bar for tab screens, which have no native header. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={17} color={colors.inkFaint} />
      <TextInput
        style={s.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function QtyStepper({
  qty,
  onChange,
  compact,
}: {
  qty: number;
  onChange: (next: number) => void;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  if (qty <= 0) {
    return (
      <TouchableOpacity
        style={[s.addBtn, compact && s.addBtnCompact]}
        onPress={() => onChange(1)}
        accessibilityLabel={t("orders.place")}
      >
        <Ionicons name="add" size={compact ? 16 : 18} color={colors.onDark} />
      </TouchableOpacity>
    );
  }
  return (
    <View style={[s.stepper, compact && s.stepperCompact]}>
      <TouchableOpacity
        style={s.stepBtn}
        onPress={() => onChange(qty - 1)}
        accessibilityLabel={t("common.decreaseQuantity")}
      >
        <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={15} color={colors.ink} />
      </TouchableOpacity>
      <Text style={s.stepQty}>{qty}</Text>
      <TouchableOpacity
        style={s.stepBtn}
        onPress={() => onChange(qty + 1)}
        accessibilityLabel={t("common.increaseQuantity")}
      >
        <Ionicons name="add" size={15} color={colors.ink} />
      </TouchableOpacity>
    </View>
  );
}

export function EmptyState({
  icon = "cube-outline",
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <MaterialCommunityIcons name={icon as any} size={28} color={colors.green} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={s.emptyBtn} onPress={onAction}>
          <Text style={s.emptyBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const ORDER_STATUS_META: Record<string, { label: string; tint: string; bg: string }> = {
  placed: { label: "Placed", tint: "#8A6A12", bg: colors.goldSoft },
  confirmed: { label: "Confirmed", tint: colors.green, bg: colors.greenSoft },
  packed: { label: "Packed", tint: colors.green, bg: colors.greenSoft },
  out_for_delivery: { label: "Out for delivery", tint: "#2F5B8F", bg: "#DFEAF6" },
  delivered: { label: "Delivered", tint: colors.onDark, bg: colors.green },
  rejected: { label: "Rejected", tint: colors.danger, bg: colors.dangerSoft },
};

export function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.placed;
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }]}>
      <Text style={[s.pillText, { color: meta.tint }]}>{t(`status.${status}`, { status: meta.label })}</Text>
    </View>
  );
}

const TIMELINE_STEPS = ["confirmed", "packed", "out_for_delivery", "delivered"] as const;
const TIMELINE_ICON: Record<string, string> = {
  confirmed: "clipboard-check-outline",
  packed: "package-variant-closed",
  out_for_delivery: "truck-outline",
  delivered: "check-circle-outline",
};

export function OrderTimeline({ status }: { status: string }) {
  const currentIndex = TIMELINE_STEPS.indexOf(status as any);
  return (
    <View style={s.timeline}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = currentIndex >= 0 && i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <View key={step} style={s.tlStep}>
            {i > 0 && <View style={[s.tlBar, done && s.tlBarDone]} />}
            <View style={[s.tlDot, done && s.tlDotDone, isCurrent && s.tlDotCurrent]}>
              <MaterialCommunityIcons
                name={TIMELINE_ICON[step] as any}
                size={13}
                color={done ? colors.onDark : colors.inkFaint}
              />
            </View>
            <Text style={[s.tlLabel, isCurrent && s.tlLabelCurrent]} numberOfLines={1}>
              {ORDER_STATUS_META[step].label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: colors.ink },
  headerSub: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14.5, color: colors.ink },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.inkMuted },
  chipTextActive: { color: colors.onDark },

  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnCompact: { width: 30, height: 30 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 4,
    gap: 2,
  },
  stepperCompact: { paddingVertical: 2 },
  stepBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  stepQty: { fontSize: 14, fontWeight: "700", color: colors.ink, minWidth: 20, textAlign: "center" },

  empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 16.5, fontWeight: "700", color: colors.ink },
  emptyBody: {
    fontSize: 13.5,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.green,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  emptyBtnText: { color: colors.onDark, fontWeight: "700" },

  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "700" },

  timeline: { flexDirection: "row", marginTop: spacing.lg },
  tlStep: { flex: 1, alignItems: "center" },
  tlBar: {
    position: "absolute",
    top: 13,
    right: "50%",
    left: "-50%",
    height: 2,
    backgroundColor: colors.track,
  },
  tlBarDone: { backgroundColor: colors.green },
  tlDot: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  tlDotDone: { backgroundColor: colors.greenMid },
  tlDotCurrent: { backgroundColor: colors.green },
  tlLabel: { fontSize: 9.5, color: colors.inkMuted, marginTop: 6, fontWeight: "600" },
  tlLabelCurrent: { color: colors.green, fontWeight: "800" },
});

export { shadow };
