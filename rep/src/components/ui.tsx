import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, control, FILTER_ROW_HEIGHT, radius, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";
import { useHeaderPaddingTop } from "./companion";
export {
  AppScreen,
  AttentionRow,
  CustomerRow,
  CustomerRowSkeleton,
  ErrorState,
  FilterChip,
  FilterChipRow,
  FocusCard,
  InitialsBadge,
  MetricStrip,
  OfflineBanner,
  PersonalGreeting,
  ProgressRow,
  SectionHeader,
  Skeleton,
  StatusChip,
  Surface,
  TaskRow,
  TextButton,
  TimelineEvent,
  useHeaderPaddingTop,
} from "./companion";

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
  const paddingTop = useHeaderPaddingTop();
  return (
    <View style={[s.header, { paddingTop }]}>
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
      style={{ flexGrow: 0, height: FILTER_ROW_HEIGHT }}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
        alignItems: "center",
        height: FILTER_ROW_HEIGHT,
      }}
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

/** The app's standard surface: white, hairline border, large radius. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

/** A small labelled number. Three of these fit a phone row. */
export function MetricTile({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "green" | "danger";
}) {
  return (
    <View style={s.metric}>
      <Text style={s.metricLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text
        style={[
          s.metricValue,
          tone === "green" && { color: colors.green },
          tone === "danger" && { color: colors.danger },
        ]}
        numberOfLines={1}
        // Large rupee figures shrink to fit rather than being cut off: a
        // truncated "₹2,60,5…" is worse than a slightly smaller number.
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
    </View>
  );
}

export function ProgressTrack({
  pct,
  tone,
}: {
  pct: number;
  tone?: "green" | "danger" | "accent";
}) {
  // Progress toward a goal is the warm accent's job; green stays for actions
  // and danger stays for money that is genuinely late.
  const fill =
    tone === "danger" ? colors.danger : tone === "accent" ? colors.accentPrimary : colors.green;
  return (
    <View style={s.track}>
      <View
        style={[s.trackFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: fill }]}
      />
    </View>
  );
}

/**
 * A full-width notice. `attention` is used for things the salesperson has to
 * act on, never for ordinary state.
 */
export function Banner({
  tone,
  title,
  body,
  icon,
  action,
}: {
  tone: "active" | "idle" | "attention";
  title: string;
  body?: string;
  icon?: string;
  action?: React.ReactNode;
}) {
  const palette =
    tone === "active"
      ? { bg: colors.greenSoft, fg: colors.green }
      : tone === "attention"
        ? { bg: colors.goldSoft, fg: "#8A6A12" }
        : { bg: colors.surfaceAlt, fg: colors.inkMuted };
  return (
    <View style={[s.banner, { backgroundColor: palette.bg }]}>
      <Ionicons
        name={(icon ?? (tone === "attention" ? "alert-circle-outline" : "location-outline")) as any}
        size={17}
        color={palette.fg}
      />
      <View style={{ flex: 1 }}>
        <Text style={[s.bannerTitle, { color: palette.fg }]}>{title}</Text>
        {body ? <Text style={s.bannerBody}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** One tappable line in a list: leading icon, title, subtitle, chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  first,
  danger,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
}) {
  const body = (
    <View style={[s.listRow, !first && s.listRowDivided]}>
      {icon ? (
        <View style={s.listIcon}>
          <Ionicons name={icon as any} size={17} color={danger ? colors.danger : colors.green} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.listTitle, danger && { color: colors.danger }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.listSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      {body}
    </TouchableOpacity>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  tone = "green",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: string;
  tone?: "green" | "danger";
}) {
  return (
    <TouchableOpacity
      style={[
        s.primary,
        tone === "danger" && { backgroundColor: colors.danger },
        disabled && s.primaryDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {icon ? <Ionicons name={icon as any} size={16} color={colors.onDark} /> : null}
      <Text style={s.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.secondary, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      {icon ? <Ionicons name={icon as any} size={15} color={colors.green} /> : null}
      <Text style={s.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A neutral status label. `StatusPill` stays the order-specific one. */
export function Tag({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "gold" | "danger";
}) {
  const palette =
    tone === "green"
      ? { bg: colors.greenSoft, fg: colors.green }
      : tone === "gold"
        ? { bg: colors.goldSoft, fg: "#8A6A12" }
        : tone === "danger"
          ? { bg: colors.dangerSoft, fg: colors.danger }
          : { bg: colors.surfaceAlt, fg: colors.inkMuted };
  return (
    <View style={[s.pill, { backgroundColor: palette.bg }]}>
      <Text style={[s.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

/** Short options picked inline — visit purpose, expense category, priority. */
export function OptionGrid({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.optionGrid}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[s.option, active && s.optionActive]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.optionText, active && s.optionTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export const inputStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: radius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.ink,
  fontSize: 14,
  borderWidth: 1,
  borderColor: colors.border,
};

const s = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 22, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
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
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
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

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.separator,
    gap: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.inkMuted, letterSpacing: 0.4, textTransform: "uppercase" },

  metric: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  metricLabel: { fontSize: 10.5, color: colors.inkMuted, lineHeight: 14 },
  metricValue: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 4 },

  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 3 },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerTitle: { fontSize: 13, fontWeight: "700" },
  bannerBody: { fontSize: 12, color: colors.inkMuted, lineHeight: 17, marginTop: 2 },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  listRowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  listSub: { fontSize: 12, color: colors.inkMuted, marginTop: 2, lineHeight: 17 },

  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: control.buttonHeight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  primaryDisabled: { backgroundColor: colors.inkFaint },
  primaryText: { color: colors.onDark, fontWeight: "600", fontSize: 15 },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    minHeight: control.buttonHeight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  secondaryText: { color: colors.primary, fontWeight: "600", fontSize: 14 },

  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  optionText: { fontSize: 12.5, fontWeight: "600", color: colors.inkMuted },
  optionTextActive: { color: colors.green },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.inkMuted },
  fieldHint: { fontSize: 11.5, color: colors.inkFaint, lineHeight: 16 },

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

export { shadow } from "../theme";
