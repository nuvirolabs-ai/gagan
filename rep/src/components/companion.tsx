import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic } from "../feedback/haptics";
import {
  colors,
  composeGreeting,
  control,
  elevation,
  FILTER_CHIP_HEIGHT,
  FILTER_ROW_HEIGHT,
  headerInsetTop,
  initials,
  metricColumnCount,
  motion,
  radius,
  spacing,
  type as typeRoles,
} from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function useHeaderPaddingTop(): number {
  const insets = useSafeAreaInsets();
  const androidStatus = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  return headerInsetTop(insets.top, androidStatus);
}

type ReducedMotionListener = (value: boolean) => void;
const reducedMotionListeners = new Set<ReducedMotionListener>();
let reducedMotionValue = false;
let reducedMotionSubscription: { remove: () => void } | null = null;
let reducedMotionRequested = false;

function notifyReducedMotion(value: boolean) {
  reducedMotionValue = value;
  reducedMotionListeners.forEach((listener) => listener(value));
}

function ensureReducedMotionSubscription() {
  if (reducedMotionRequested) return;
  reducedMotionRequested = true;
  AccessibilityInfo.isReduceMotionEnabled().then(notifyReducedMotion).catch(() => undefined);
  reducedMotionSubscription = AccessibilityInfo.addEventListener("reduceMotionChanged", notifyReducedMotion);
}

/** One app-level listener keeps long lists from subscribing row-by-row. */
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reducedMotionValue);
  useEffect(() => {
    reducedMotionListeners.add(setValue);
    ensureReducedMotionSubscription();
    return () => {
      reducedMotionListeners.delete(setValue);
      if (reducedMotionListeners.size === 0 && reducedMotionSubscription) {
        reducedMotionSubscription.remove();
        reducedMotionSubscription = null;
        reducedMotionRequested = false;
      }
    };
  }, []);
  return value;
}

/**
 * Shared native-driver press feedback. Layout and geometry never change while
 * pressed; only opacity changes and the control provides a light haptic.
 */
export function TactilePressable({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  hitSlop,
  hapticKind = "light",
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: any;
  accessibilityState?: any;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  hapticKind?: "light" | "medium" | "success" | "warning";
  testID?: string;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  const animate = (toOpacity: number) => {
    if (reduceMotion) {
      opacity.setValue(toOpacity);
      return;
    }
    Animated.timing(opacity, { toValue: toOpacity, duration: motion.fast, useNativeDriver: true }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      onPressIn={() => {
        if (disabled) return;
        haptic(hapticKind);
        animate(0.92);
      }}
      onPressOut={() => animate(disabled ? 0.5 : 1)}
      style={[styles.tactilePressable, disabled && styles.tactileDisabled, style, { opacity }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function AppScreen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  // The app uses React Navigation's normal-flow bottom tabs. The navigator
  // allocates the tab bar as a sibling below the scene, so the shared shell
  // must not consume BottomTabBarHeightContext as screen padding. Doing so
  // shrinks every tab scene by one complete tab-bar height and creates a
  // permanent, scroll-proof blank band above the visible bar.
  //
  // Keep this shell transform-free. On Android, translating a parent that
  // owns many Pressables can leave native hit testing in the pre-transform
  // coordinate space while the pixels have already moved. Fade-only entrance
  // preserves the material motion without ever separating visible controls
  // from their native touch geometry.
  const entrance = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.screen,
        {
          opacity: entrance,
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.ambientTop} />
      {children}
    </Animated.View>
  );
}

export function PersonalGreeting({
  name,
  salutation,
  dateLabel,
  statusLabel,
  right,
}: {
  name: string;
  salutation: string;
  dateLabel: string;
  statusLabel?: string;
  right?: React.ReactNode;
}) {
  const paddingTop = useHeaderPaddingTop();
  return (
    <View style={[styles.greeting, { paddingTop }]}>
      <View style={styles.greetingAvatar}>
        <Text style={styles.greetingInitials}>{initials(name || "?")}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.greetingHello} numberOfLines={1}>
          {composeGreeting(salutation, name)}
        </Text>
        {statusLabel ? <Text style={styles.greetingStatus} numberOfLines={1}>{statusLabel}</Text> : null}
        <Text style={styles.greetingDate}>{dateLabel}</Text>
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {action}
    </View>
  );
}

export function FocusCard({
  children,
  tone = "green",
  style,
}: {
  children: React.ReactNode;
  tone?: "green" | "gold" | "neutral" | "danger";
  style?: ViewStyle;
}) {
  const palette =
    tone === "gold"
      ? { bg: colors.surfaceSecondary, border: colors.separator }
      : tone === "danger"
        ? { bg: colors.dangerSoft, border: colors.dangerSoft }
        : tone === "neutral"
          ? { bg: colors.surface, border: colors.separator }
          : { bg: colors.primarySoft, border: colors.separator };
  return (
    <View style={[styles.focusCard, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      {children}
    </View>
  );
}

export function Surface({
  children,
  level = 2,
  style,
}: {
  children: React.ReactNode;
  level?: 1 | 2 | 3;
  style?: ViewStyle;
}) {
  return <View style={[level === 1 ? styles.surface1 : level === 3 ? styles.surface3 : styles.surface2, style]}>{children}</View>;
}

export function MetricStrip({
  items,
  bare,
}: {
  items: Array<{ label: string; value: string; tone?: "ink" | "danger" | "gold" }>;
  bare?: boolean;
}) {
  const { width } = useWindowDimensions();
  const longest = items.reduce((max, item) => Math.max(max, item.label.length), 0);
  const columns = metricColumnCount(width, items.length, longest);
  const wrapped = columns < items.length;

  return (
    <View style={[styles.metricStrip, bare && styles.metricStripBare, wrapped && styles.metricStripWrap]}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            styles.metricItem,
            wrapped ? [styles.metricItemWrap, { width: `${100 / columns}%` as `${number}%` }] : null,
            !wrapped && index > 0 ? styles.metricItemDivided : null,
          ]}
        >
          <Text
            style={[
              styles.metricValue,
              item.tone === "danger" && { color: colors.danger },
              item.tone === "gold" && { color: colors.goldStrong },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {item.value}
          </Text>
          <Text style={styles.metricLabel} numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ProgressRow({
  pct,
  tone = "gold",
}: {
  pct: number;
  tone?: "gold" | "green" | "danger";
}) {
  const fill =
    tone === "danger" ? colors.danger : tone === "green" ? colors.primary : colors.gold;
  const width = Math.max(0, Math.min(100, pct));
  const animated = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      animated.setValue(width);
      return;
    }
    Animated.timing(animated, {
      toValue: width,
      duration: motion.progress,
      useNativeDriver: false,
    }).start();
  }, [animated, reduceMotion, width]);

  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ now: width, min: 0, max: 100 }}>
      <Animated.View
        style={[
          styles.trackFill,
          {
            backgroundColor: fill,
            width: animated.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

export function TextButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TactilePressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      style={styles.textBtn}
    >
      <Text style={styles.textBtnLabel}>{label}</Text>
    </TactilePressable>
  );
}

export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TactilePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TactilePressable>
  );
}

export function FilterChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.chipRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function CustomerRowSkeleton() {
  return (
    <View style={styles.customerRow} accessibilityRole="progressbar">
      <View style={styles.skelAvatar} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skelLine, { width: "58%" }]} />
        <View style={[styles.skelLine, { width: "36%", height: 10 }]} />
      </View>
    </View>
  );
}

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "gold" | "danger" | "warning" | "info";
}) {
  const palette =
    tone === "green"
      ? { bg: colors.successSoft, fg: colors.success }
      : tone === "gold"
        ? { bg: colors.goldSoft, fg: colors.goldStrong }
        : tone === "danger"
          ? { bg: colors.dangerSoft, fg: colors.danger }
          : tone === "warning"
            ? { bg: colors.warningSoft, fg: colors.warning }
            : tone === "info"
              ? { bg: colors.infoSoft, fg: colors.info }
              : { bg: colors.surfaceSecondary, fg: colors.textSecondary };
  return (
    <View style={[styles.statusChip, { backgroundColor: palette.bg }]}>
      <Text style={[styles.statusChipText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function InitialsBadge({
  name,
  size = 40,
  tone = "green",
}: {
  name: string;
  size?: number;
  tone?: "green" | "gold" | "danger" | "neutral";
}) {
  const bg =
    tone === "gold"
      ? colors.goldSoft
      : tone === "danger"
        ? colors.dangerSoft
        : tone === "neutral"
          ? colors.surfaceSecondary
          : colors.primarySoft;
  const fg =
    tone === "gold" ? colors.goldStrong : tone === "danger" ? colors.danger : colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: size * 0.34 }}>{initials(name)}</Text>
    </View>
  );
}

export function CustomerRow({
  name,
  meta,
  dueLabel,
  creditLabel,
  dueTone = "ink",
  chip,
  onPress,
}: {
  name: string;
  meta?: string;
  dueLabel: string;
  creditLabel?: string;
  dueTone?: "ink" | "danger";
  chip?: { label: string; tone: "green" | "gold" | "danger" | "warning" | "neutral" };
  onPress: () => void;
}) {
  return (
    <TactilePressable
      onPress={onPress}
      accessibilityRole="button"
      style={styles.customerRow}
    >
      <InitialsBadge name={name} tone={dueTone === "danger" ? "danger" : "green"} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.customerTop}>
          <Text style={styles.customerName} numberOfLines={1}>
            {name}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
        {chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
        <View style={styles.customerMoney}>
          <Text
            style={[styles.customerDue, dueTone === "danger" && { color: colors.danger }]}
            numberOfLines={1}
          >
            {dueLabel}
          </Text>
          {creditLabel ? (
            <Text style={styles.customerCredit} numberOfLines={1}>
              {creditLabel}
            </Text>
          ) : null}
        </View>
        {meta ? (
          <Text style={styles.customerMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </TactilePressable>
  );
}

export function AttentionRow({
  title,
  subtitle,
  icon = "alert-circle-outline",
  tone = "warning",
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  tone?: "warning" | "danger" | "gold" | "green";
  onPress?: () => void;
}) {
  const color =
    tone === "danger" ? colors.danger : tone === "gold" ? colors.goldStrong : tone === "green" ? colors.primary : colors.warning;
  const body = (
    <View style={styles.attentionRow}>
      <View style={[styles.attentionIcon, { backgroundColor: tone === "danger" ? colors.dangerSoft : tone === "green" ? colors.primarySoft : colors.warningSoft }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.attentionTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.attentionSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <TactilePressable onPress={onPress} accessibilityRole="button">
      {body}
    </TactilePressable>
  );
}

export function TaskRow({
  title,
  subtitle,
  done,
  overdue,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  done?: boolean;
  overdue?: boolean;
  onComplete?: () => void;
}) {
  return (
    <View style={styles.taskRow}>
      <TactilePressable
        onPress={done ? undefined : onComplete}
        disabled={done || !onComplete}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: Boolean(done) }}
        accessibilityLabel={title}
        hitSlop={6}
        style={styles.taskCheck}
      >
        <Ionicons
          name={done ? "checkmark-circle" : overdue ? "alert-circle-outline" : "ellipse-outline"}
          size={22}
          color={done ? colors.primary : overdue ? colors.danger : colors.textTertiary}
        />
      </TactilePressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.taskTitle, done && styles.taskDone]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.taskSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function TimelineEvent({
  icon,
  title,
  context,
  amount,
  time,
  last,
}: {
  icon: string;
  title: string;
  context?: string;
  amount?: string;
  time?: string;
  last?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot}>
          <Ionicons name={icon as any} size={13} color={colors.primary} />
        </View>
        {!last ? <View style={styles.timelineSpine} /> : null}
      </View>
      <View style={[styles.timelineBody, last && { paddingBottom: 0 }]}>
        <View style={styles.timelineTop}>
          <Text style={styles.timelineTitle} numberOfLines={2}>
            {title}
          </Text>
          {amount ? <Text style={styles.timelineAmount}>{amount}</Text> : null}
        </View>
        {context ? (
          <Text style={styles.timelineContext} numberOfLines={2}>
            {context}
          </Text>
        ) : null}
        {time ? <Text style={styles.timelineTime}>{time}</Text> : null}
      </View>
    </View>
  );
}

export function OfflineBanner({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.offline}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
      <View style={{ flex: 1 }}>
        <Text style={styles.offlineTitle}>{title}</Text>
        {body ? <Text style={styles.offlineBody}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function Skeleton({ height = 16, width = "100%", radius: r = 8 }: { height?: number; width?: number | `${number}%` | string; radius?: number }) {
  return (
    <View
      style={{
        height,
        width: width as any,
        borderRadius: r,
        backgroundColor: colors.surfaceSecondary,
      }}
    />
  );
}

export function ErrorState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
      <Text style={styles.errorTitle}>{title}</Text>
      {body ? <Text style={styles.errorBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
      <TactilePressable onPress={onAction} style={styles.errorAction}>
        <Text style={styles.errorActionText}>{actionLabel}</Text>
      </TactilePressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, overflow: "hidden" },
  ambientTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 240,
    backgroundColor: colors.blueSoft,
    opacity: 0.28,
  },
  tactilePressable: { alignSelf: "stretch" },
  tactileDisabled: { opacity: 0.5 },
  greeting: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  greetingAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingInitials: { color: colors.blueInk, fontWeight: "700", fontSize: 16 },
  greetingHello: { ...typeRoles.screenTitle, fontSize: 20, letterSpacing: -0.35 },
  greetingStatus: { color: colors.inkMuted, fontSize: 13, lineHeight: 17, marginTop: 1 },
  greetingDate: { color: colors.inkFaint, fontSize: 11.5, lineHeight: 15, marginTop: 1 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typeRoles.sectionTitle,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },

  focusCard: {
    borderRadius: radius.hero,
    padding: spacing.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  surface1: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  surface2: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...elevation.card,
  },
  surface3: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...elevation.floating,
  },

  metricStrip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  metricStripBare: {
    backgroundColor: "transparent",
    paddingVertical: 0,
  },
  metricStripWrap: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  metricItem: { flex: 1, paddingHorizontal: spacing.sm, alignItems: "center" },
  metricItemWrap: { flexGrow: 0, flexShrink: 0, paddingVertical: spacing.sm, borderLeftWidth: 0 },
  metricItemDivided: { borderLeftWidth: 1, borderLeftColor: colors.separator },
  metricValue: { ...typeRoles.metricMedium, textAlign: "center" },
  metricLabel: { ...typeRoles.micro, marginTop: 4, textAlign: "center" },

  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 4 },

  textBtn: { minHeight: 32, justifyContent: "center" },
  textBtnLabel: { color: colors.primary, fontWeight: "600", fontSize: 13 },

  filterChip: {
    height: FILTER_CHIP_HEIGHT,
    minHeight: FILTER_CHIP_HEIGHT,
    maxHeight: FILTER_CHIP_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRow: {
    height: FILTER_ROW_HEIGHT,
    flexGrow: 0,
    flexShrink: 0,
  },
  chipScroll: {
    flexGrow: 0,
    height: FILTER_ROW_HEIGHT,
  },
  chipContent: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    height: FILTER_ROW_HEIGHT,
  },
  skelAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceSecondary,
  },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterChipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  filterChipTextActive: { color: colors.onDark },

  statusChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  statusChipText: { fontSize: 11, fontWeight: "600" },

  customerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    minHeight: control.minTap,
  },
  customerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  customerName: { ...typeRoles.bodyStrong, flex: 1 },
  customerMoney: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: 6 },
  customerDue: { ...typeRoles.caption, fontWeight: "600", color: colors.ink },
  customerCredit: { ...typeRoles.caption },
  customerMeta: { ...typeRoles.micro, marginTop: 4 },

  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    minHeight: control.minTap,
  },
  attentionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionTitle: { ...typeRoles.bodyStrong, fontSize: 14 },
  attentionSub: { ...typeRoles.caption, marginTop: 2 },

  taskRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: 12 },
  taskCheck: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  taskTitle: { ...typeRoles.body, fontSize: 15 },
  taskDone: { color: colors.textSecondary, textDecorationLine: "line-through" },
  taskSub: { ...typeRoles.micro, marginTop: 2 },

  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineRail: { width: 28, alignItems: "center" },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineSpine: { width: 2, flex: 1, backgroundColor: colors.separator, marginTop: 4, minHeight: 12 },
  timelineBody: { flex: 1, paddingBottom: spacing.lg },
  timelineTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  timelineTitle: { ...typeRoles.bodyStrong, flex: 1, fontSize: 15 },
  timelineAmount: { ...typeRoles.bodyStrong, fontSize: 14 },
  timelineContext: { ...typeRoles.caption, marginTop: 2 },
  timelineTime: { ...typeRoles.micro, marginTop: 4 },

  offline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  offlineTitle: { fontSize: 13, fontWeight: "600", color: colors.warning },
  offlineBody: { ...typeRoles.caption, marginTop: 2 },

  errorBox: { alignItems: "center", paddingVertical: spacing.block, paddingHorizontal: spacing.xl, gap: spacing.sm },
  errorTitle: { ...typeRoles.bodyStrong, textAlign: "center" },
  errorBody: { ...typeRoles.caption, textAlign: "center" },
  errorAction: { marginTop: spacing.sm, minHeight: control.minTap, justifyContent: "center" },
  errorActionText: { color: colors.primary, fontWeight: "600" },
});
