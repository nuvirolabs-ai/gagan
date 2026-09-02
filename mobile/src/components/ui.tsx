import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
      <Text style={s.wordmark}>
        GAGA<Text style={{ color: colors.green }}>N</Text>
      </Text>
      <View style={s.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={s.headerTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {title}
          </Text>
          {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function ScreenSkeleton({
  search = false,
  chips = false,
  featured = false,
  rows = 4,
}: {
  search?: boolean;
  chips?: boolean;
  featured?: boolean;
  rows?: number;
}) {
  return (
    <View style={s.skeleton} accessibilityLabel="Loading">
      {search ? <View style={s.skelSearch} /> : null}
      {chips ? (
        <View style={s.skelPills}>
          <View style={[s.skelPill, { width: 64 }]} />
          <View style={[s.skelPill, { width: 56 }]} />
          <View style={[s.skelPill, { width: 52 }]} />
        </View>
      ) : null}
      {featured ? <View style={s.skelFeatured} /> : null}
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={s.skelRow} />
      ))}
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
  labels,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm }}
    >
      {options.map((opt) => {
        const active = opt === value;
        const label = labels?.[opt] ?? opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
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
        accessibilityLabel={t("product.addToCart")}
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
  icon: _icon = "cube-outline",
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
      <Text style={s.emptyTitle}>{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={s.emptyBtn} onPress={onAction} accessibilityRole="button">
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

export function OrderTimeline({ status }: { status: string }) {
  const { t } = useLanguage();
  const currentIndex = TIMELINE_STEPS.indexOf(status as any);
  return (
    <View style={s.timeline}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = currentIndex >= 0 && i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <View key={step} style={s.tlStep}>
            {i > 0 && <View style={[s.tlBar, done && s.tlBarDone]} />}
            <View style={[s.tlDot, done && s.tlDotDone, isCurrent && s.tlDotCurrent]} />
            <Text style={[s.tlLabel, isCurrent && s.tlLabelCurrent]} numberOfLines={1}>
              {t(`status.${step}`, { status: ORDER_STATUS_META[step].label })}
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
    backgroundColor: colors.bg,
  },
  wordmark: { fontSize: 13, fontWeight: "800", color: colors.green, letterSpacing: 1.6, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "flex-end" },
  headerTitle: { fontSize: 26, fontWeight: "700", color: colors.ink },
  headerSub: { fontSize: 13, color: colors.inkMuted, marginTop: 4, fontWeight: "500" },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

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
    minHeight: 44,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: colors.ink },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  chipActive: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.inkMuted },
  chipTextActive: { color: colors.onDark },

  skeleton: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  skelSearch: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  skelPills: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  skelPill: { height: 32, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  skelFeatured: { height: 132, borderRadius: radius.lg, backgroundColor: colors.cream, marginBottom: spacing.md },
  skelRow: { height: 72, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },

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

  empty: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: 4 },
  emptyTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkMuted, lineHeight: 18 },
  emptyBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    backgroundColor: colors.greenDeep,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  emptyBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 14 },

  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "700" },

  timeline: { flexDirection: "row", marginTop: spacing.lg },
  tlStep: { flex: 1, alignItems: "center" },
  tlBar: {
    position: "absolute",
    top: 5,
    right: "50%",
    left: "-50%",
    height: 2,
    backgroundColor: colors.track,
  },
  tlBarDone: { backgroundColor: colors.green },
  tlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.track,
  },
  tlDotDone: { backgroundColor: colors.greenMid },
  tlDotCurrent: { backgroundColor: colors.green, width: 12, height: 12, borderRadius: 6 },
  tlLabel: { fontSize: 9.5, color: colors.inkMuted, marginTop: 6, fontWeight: "600" },
  tlLabelCurrent: { color: colors.green, fontWeight: "800" },
});

export { shadow };
