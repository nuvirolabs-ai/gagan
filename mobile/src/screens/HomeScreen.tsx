import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import { api } from "../api/client";
import { HomePayload, QuickOrderItem } from "../types/home";
import { useCart } from "../context/CartContext";
import { colors, radius, spacing, shadow, inr } from "../theme";
import ProductThumb from "../components/ProductThumb";
import ProductGroupCard, { type ProductGroupLike, type Sku } from "../components/ProductGroupCard";
import CreditRing from "../components/CreditRing";
import { useLanguage } from "../i18n/LanguageContext";

const ORDER_STEPS = ["confirmed", "packed", "out_for_delivery", "delivered"] as const;
const ALL_CATEGORY = "All";
const CATEGORY_LABELS: Record<string, string> = {
  All: "All",
  Pulses: "Daal",
  Daal: "Daal",
  Rice: "Rice",
  Sugar: "Sugar",
  Staples: "Staples",
  Breakfast: "Breakfast",
};
const CATEGORY_ICONS: Record<string, string> = {
  All: "grid-outline",
  Daal: "nutrition-outline",
  Pulses: "nutrition-outline",
  Rice: "restaurant-outline",
  Sugar: "cube-outline",
  Staples: "cube-outline",
  Breakfast: "cafe-outline",
};
const STEP_META: Record<(typeof ORDER_STEPS)[number], { label: string; icon: string }> = {
  confirmed: { label: "Confirmed", icon: "clipboard-check-outline" },
  packed: { label: "Packed", icon: "package-variant-closed" },
  out_for_delivery: { label: "Out for Delivery", icon: "truck-outline" },
  delivered: { label: "Delivered", icon: "check-circle-outline" },
};

function greeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t("home.goodMorning");
  if (h < 17) return t("home.goodAfternoon");
  return t("home.goodEvening");
}

/** The card a SKU belongs to, so a cart line carries the product's real name. */
function groupNameForSku(groups: ProductGroupLike[], variantId: string): string {
  return groups.find((group) => group.skus.some((sku) => sku.id === variantId))?.name ?? "Product";
}

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { lines, addLine, updateQty } = useCart();
  const { t } = useLanguage();
  const [data, setData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);

  const load = useCallback(async () => {
    const res = await api.getHome();
    setData(res);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      // A rejected session clears the token and bounces to Login; swallow the
      // rejection here so it doesn't surface as an unhandled promise.
      load()
        .catch(() => {
          if (!cancelled) setData(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const qtyFor = (variantId: string) => lines.find((l) => l.variantId === variantId)?.qty ?? 0;

  const bump = (item: QuickOrderItem, delta: number) => {
    if (item.casePrice == null) return;
    const current = qtyFor(item.variantId);
    if (current === 0 && delta > 0) {
      addLine({
        variantId: item.variantId,
        productName: item.name,
        packSize: `${item.unitSize} × ${item.unitsPerCase}`,
        unitPrice: Number(item.casePrice),
        qty: 1,
      });
    } else {
      updateQty(item.variantId, current + delta);
    }
  };

  if (loading && !data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>{t("errors.generic")}</Text>
        <TouchableOpacity style={styles.retry} onPress={onRefresh}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { retailer, salesRep, credit, scheme, quickOrder, activeOrder, config, badges } = data;
  const categories = data.categories ?? [];
  const productGroups: ProductGroupLike[] = data.productGroups ?? [];
  const visibleGroups = productGroups.filter(
    (group) => selectedCategory === ALL_CATEGORY || group.category === selectedCategory
  );

  /**
   * The cart is keyed on the SKU, not the product card: changing pack changes
   * which line is being added, and an existing line for another pack is left
   * exactly as it was.
   */
  const setSkuQty = (sku: Sku, next: number) => {
    if (sku.price == null) return;
    const current = qtyFor(sku.id);
    if (current === 0 && next > 0) {
      addLine({
        variantId: sku.id,
        productName: groupNameForSku(productGroups, sku.id),
        packSize: sku.packDetail,
        unitPrice: Number(sku.price),
        qty: next,
      });
      return;
    }
    updateQty(sku.id, next);
  };
  const visibleQuickOrder = quickOrder.filter(
    (item) => selectedCategory === ALL_CATEGORY || item.category === selectedCategory
  );
  const schemePct = scheme ? Math.min(100, (scheme.progress / scheme.targetAmount) * 100) : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            GAGA<Text style={{ color: colors.green }}>N</Text>
          </Text>
          <Text style={styles.tagline}>NUTRITION. DELIVERED.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} accessibilityLabel={t("profile.support")}>
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
            {badges.notifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badges.notifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            accessibilityLabel={t("profile.support")}
            onPress={() => config.supportPhone && Linking.openURL(`tel:${config.supportPhone}`)}
          >
            <MaterialCommunityIcons name="headset" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search — the fastest way to a product, so it comes first. */}
      <TouchableOpacity
        style={styles.searchBar}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("Products")}
        accessibilityRole="search"
        accessibilityLabel={t("catalog.search")}
      >
        <Ionicons name="search" size={17} color={colors.inkFaint} />
        <Text style={styles.searchPlaceholder}>{t("catalog.search")}</Text>
      </TouchableOpacity>

      {/* What is owed, and the two things a retailer can do about it. A calm
          paid-up line replaces it when nothing is outstanding, so the screen
          never invents a debt. */}
      {credit.outstanding > 0 ? (
        <View style={styles.dueCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dueLabel}>{t("home.outstandingAmount")}</Text>
              <Text style={styles.dueValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {inr(credit.outstanding)}
              </Text>
              {credit.overdue > 0 ? (
                <Text style={styles.dueOverdue}>{inr(credit.overdue)} overdue</Text>
              ) : (
                <Text style={styles.dueSub}>
                  {t("home.available")} {inr(credit.available)}
                </Text>
              )}
            </View>
            <CreditRing pct={credit.utilisationPct} />
          </View>
          <View style={styles.dueActions}>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => navigation.navigate("Pay")}
              accessibilityLabel={t("home.payNow")}
            >
              <Ionicons name="card-outline" size={16} color={colors.onDark} />
              <Text style={styles.payBtnText}>{t("home.payNow")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ledgerOutlineBtn}
              onPress={() => navigation.navigate("Ledger")}
            >
              <Text style={styles.ledgerOutlineText}>{t("home.viewLedger")}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.green} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.paidUpCard}>
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
          <Text style={styles.paidUpText}>{t("home.paidUp")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Ledger")}>
            <Text style={styles.link}>{t("home.viewLedger")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* A compact selector: categories are a filter, not a landing page, so
          they take one row instead of pushing the shelf below the fold. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {[ALL_CATEGORY, ...categories].map((value) => {
          const active = selectedCategory === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedCategory(value)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {CATEGORY_LABELS[value] ?? value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Products, immediately. Each card is one logical product with its pack
          sizes, so a shopper chooses a pack instead of scrolling past the same
          product three times. */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === ALL_CATEGORY
            ? t("home.quickOrder")
            : CATEGORY_LABELS[selectedCategory] ?? selectedCategory}
        </Text>
        <TouchableOpacity style={styles.rowCenter} onPress={() => navigation.navigate("Products")}>
          <Text style={styles.link}>{t("home.viewProducts")}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.green} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
      <View style={styles.productList}>
        {visibleGroups.length === 0 ? (
          <Text style={styles.emptyProducts}>{t("home.noProductsInCategory")}</Text>
        ) : (
          visibleGroups.map((group) => (
            <ProductGroupCard
              key={group.id}
              group={group}
              qtyFor={qtyFor}
              onChangeQty={setSkuQty}
              onOpen={() =>
                navigation.navigate("ProductDetail", { productId: group.skus[0]?.productId })
              }
            />
          ))
        )}
      </View>

      {/* Scheme banner */}
      {scheme && (
        <TouchableOpacity style={styles.scheme} activeOpacity={0.9}>
          <View style={{ flex: 1 }}>
            <View style={styles.rowCenter}>
              <MaterialCommunityIcons name="crown" size={15} color={colors.gold} />
              <Text style={styles.schemeTag}>{scheme.name}</Text>
            </View>
            <Text style={styles.schemeHeadline}>{scheme.headline}</Text>
            <View style={styles.schemeTrack}>
              <View style={[styles.schemeFill, { width: `${schemePct}%` }]} />
            </View>
            <Text style={styles.schemeFoot}>
              {scheme.remaining > 0
                ? `You are ${inr(scheme.remaining)} away from unlocking`
                : `Unlocked — ${inr(scheme.discountAmount)} discount earned`}
            </Text>
          </View>
          <View style={styles.schemeChevron}>
            <Ionicons name="chevron-forward" size={18} color={colors.onDark} />
          </View>
        </TouchableOpacity>
      )}

      {/* Active order */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("home.myOrders")}</Text>
        <TouchableOpacity style={styles.rowCenter} onPress={() => navigation.navigate("Orders")}>
          <Text style={styles.link}>{t("home.viewOrders")}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.green} style={{ marginLeft: 3 }} />
        </TouchableOpacity>
      </View>
      {activeOrder ? (
        <TouchableOpacity
          style={styles.orderCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("DeliveryTracking", { orderId: activeOrder.id })}
        >
          <View style={styles.orderTop}>
            <View style={styles.orderIcon}>
              <MaterialCommunityIcons name="truck-outline" size={22} color={colors.onDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId} numberOfLines={1}>
                Order #GGN-{String(activeOrder.orderNo).padStart(5, "0")}
              </Text>
              <Text style={styles.orderMeta}>
                Placed on{" "}
                {new Date(activeOrder.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
                {"  ·  "}
                {new Date(activeOrder.createdAt).toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
              {activeOrder.expectedDeliveryAt && (
                <Text style={styles.orderMeta} numberOfLines={1}>
                  Expected today by{" "}
                  {new Date(activeOrder.expectedDeliveryAt).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              )}
            </View>
            <View style={styles.orderRight}>
              <Text style={styles.orderTotal}>{inr(activeOrder.orderTotal)}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {STEP_META[activeOrder.status as keyof typeof STEP_META]?.label ?? "Placed"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} style={{ marginTop: 2 }} />
          </View>

          <View style={styles.timeline}>
            {ORDER_STEPS.map((step, i) => {
              const currentIndex = ORDER_STEPS.indexOf(activeOrder.status as any);
              const done = currentIndex >= 0 && i <= currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <View key={step} style={styles.timelineStep}>
                  {i > 0 && <View style={[styles.timelineBar, done && styles.timelineBarDone]} />}
                  <View style={[styles.timelineDot, done && styles.timelineDotDone, isCurrent && styles.timelineDotCurrent]}>
                    <MaterialCommunityIcons
                      name={STEP_META[step].icon as any}
                      size={13}
                      color={done ? colors.onDark : colors.inkFaint}
                    />
                  </View>
                  <Text style={[styles.timelineLabel, isCurrent && styles.timelineLabelCurrent]} numberOfLines={1}>
                    {STEP_META[step].label}
                  </Text>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.orderCard, styles.emptyOrder]}>
          <Text style={styles.muted}>{t("home.noOrdersProgress")}</Text>
        </View>
      )}

      {/* Greeting + salesman */}
      <View style={styles.greetRow}>
        <View style={styles.greetBlock}>
          <Text style={styles.greetSmall}>{greeting(t)}</Text>
          <Text style={styles.greetName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {retailer.name} 👋
          </Text>
        </View>
        {salesRep && (
          <View style={styles.repCard}>
            <View style={styles.repAvatar}>
              <Text style={styles.repInitials}>
                {salesRep.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </Text>
            </View>
            <View style={styles.repText}>
              <Text style={styles.repLabel}>{t("home.salesman")}</Text>
              <Text style={styles.repName} numberOfLines={1}>
                {salesRep.name}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.repCall}
              accessibilityLabel={`Call ${salesRep.name}`}
              onPress={() => Linking.openURL(`tel:${salesRep.phone}`)}
            >
              <Ionicons name="call" size={16} color={colors.onDark} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Action tiles */}
      <View style={styles.tileRow}>
        {[
          { icon: "refresh", label: "Repeat Order", lib: Ionicons, onPress: () => navigation.navigate("Orders") },
          { icon: "cube-outline", label: "My Orders", lib: Ionicons, onPress: () => navigation.navigate("Orders") },
          { icon: "cash-outline", label: "Payments", lib: Ionicons, onPress: () => navigation.navigate("Ledger") },
          { icon: "document-text-outline", label: "Ledger", lib: Ionicons, onPress: () => navigation.navigate("Ledger") },
        ].map((t) => (
          <TouchableOpacity key={t.label} style={styles.tile} onPress={t.onPress}>
            <t.lib name={t.icon as any} size={20} color={colors.green} />
            <Text style={styles.tileLabel} numberOfLines={2}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.offersTile} activeOpacity={0.9}>
          <Ionicons name="chevron-forward" size={15} color={colors.onDarkMuted} style={styles.offersChevron} />
          <Text style={styles.offersGift}>🎁</Text>
          <View style={styles.offersText}>
            <Text style={styles.offersTitle}>{t("home.offers")}</Text>
            <Text style={styles.offersCount} numberOfLines={1}>
              {badges.activeOffers} Active Offers
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Info strip */}
      <View style={styles.infoStrip}>
        <View style={styles.infoCell}>
          <Feather name="truck" size={17} color={colors.green} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{t("home.freeDelivery")}</Text>
            <Text style={styles.infoSub}>On orders above {inr(config.freeDeliveryThreshold)}</Text>
          </View>
        </View>
        <View style={styles.infoCell}>
          <Feather name="calendar" size={17} color={colors.green} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{t("home.nextDelivery")}</Text>
            <Text style={styles.infoSub}>
              Tomorrow,{" "}
              {new Date(Date.now() + 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </Text>
          </View>
        </View>
        <View style={styles.infoCell}>
          <Feather name="shopping-bag" size={17} color={colors.green} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{t("home.minimumOrder")}</Text>
            <Text style={styles.infoSub}>{inr(config.minOrderValue)}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  muted: { color: colors.inkMuted, fontSize: 14 },
  retry: {
    marginTop: spacing.md,
    backgroundColor: colors.green,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  retryText: { color: colors.onDark, fontWeight: "700" },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  logo: { fontSize: 27, fontWeight: "700", color: colors.green, letterSpacing: 1 },
  tagline: { fontSize: 8.5, fontWeight: "700", color: colors.gold, letterSpacing: 1.5, marginTop: 1 },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: colors.onDark, fontSize: 10, fontWeight: "800" },

  greetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  greetBlock: { flex: 1 },
  greetSmall: { fontSize: 14, color: colors.inkMuted, fontWeight: "500" },
  greetName: { fontSize: 22, fontWeight: "700", color: colors.ink, marginTop: 2 },
  repCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    width: 172,
    ...shadow.card,
  },
  repAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  repInitials: { fontSize: 12, fontWeight: "800", color: colors.green },
  repText: { flex: 1 },
  repLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: "500" },
  repName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  repCall: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ---- Search ---- */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.md,
  },
  searchPlaceholder: { fontSize: 14, color: colors.inkFaint },

  /* ---- Outstanding, Pay Now, Ledger ---- */
  dueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  dueLabel: { fontSize: 11.5, color: colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  dueValue: { fontSize: 27, fontWeight: "800", color: colors.ink, marginTop: 3 },
  dueOverdue: { fontSize: 12.5, fontWeight: "700", color: colors.error, marginTop: 3 },
  dueSub: { fontSize: 12.5, color: colors.inkMuted, marginTop: 3 },
  dueActions: { flexDirection: "row", gap: spacing.sm },
  payBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  payBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 13.5 },
  ledgerOutlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
  },
  ledgerOutlineText: { color: colors.green, fontWeight: "700", fontSize: 13 },
  paidUpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  paidUpText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.green },

  /* ---- Compact category selector ---- */
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  chipText: { fontSize: 12.5, fontWeight: "700", color: colors.inkMuted },
  chipTextActive: { color: colors.onDark },

  /* ---- The shelf ---- */
  productList: { paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.xl },
  emptyProducts: { fontSize: 13, color: colors.inkMuted, paddingVertical: spacing.lg },

  categorySection: { marginBottom: spacing.xl },
  sectionCaption: { fontSize: 11.5, color: colors.inkMuted, marginTop: 3 },
  categoryRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  categoryCard: {
    width: 90,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
  },
  categoryCardActive: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  categoryIconActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  categoryName: { fontSize: 11.5, fontWeight: "700", color: colors.ink, textAlign: "center" },
  categoryNameActive: { color: colors.onDark },

  moneyRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.lg },
  outstandingCard: {
    flex: 1,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  outstandingLabel: { color: colors.onDarkMuted, fontSize: 12.5, fontWeight: "500" },
  outstandingValue: { color: colors.onDark, fontSize: 26, fontWeight: "700", marginTop: spacing.sm },
  overdue: { color: "#F0837A", fontSize: 12.5, fontWeight: "600", marginTop: 4 },
  ledgerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  ledgerBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 13.5 },

  creditCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  creditLabel: { fontSize: 12.5, color: colors.inkMuted, fontWeight: "500" },
  creditValue: { fontSize: 19, fontWeight: "700", color: colors.ink, marginTop: 2 },
  creditTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  creditFill: { height: "100%", backgroundColor: colors.green, borderRadius: 3 },
  creditSplit: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  creditSplitCell: { flex: 1 },
  creditDivider: { width: 1, height: 26, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  creditSplitLabel: { fontSize: 11.5, color: colors.inkMuted },
  creditSplitValue: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 2 },

  scheme: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cream,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  schemeTag: { fontSize: 10.5, fontWeight: "800", color: colors.gold, letterSpacing: 0.8, marginLeft: 4 },
  schemeHeadline: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 6, lineHeight: 23 },
  schemeTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.10)",
    overflow: "hidden",
    marginTop: spacing.md,
  },
  schemeFill: { height: "100%", backgroundColor: colors.green, borderRadius: 3 },
  schemeFoot: { fontSize: 12, color: colors.inkMuted, marginTop: spacing.sm, fontWeight: "500" },
  schemeChevron: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  link: { fontSize: 13, fontWeight: "600", color: colors.green },

  productCard: {
    width: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productName: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: spacing.md },
  productPack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  productPrice: { fontSize: 13.5, fontWeight: "700", color: colors.ink, marginTop: spacing.sm },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 5,
    marginTop: spacing.md,
  },
  stepBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  stepQty: { fontSize: 14, fontWeight: "700", color: colors.ink },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },

  orderCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    ...shadow.card,
  },
  emptyOrder: { alignItems: "center", paddingVertical: spacing.xxl },
  orderTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  orderId: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  orderMeta: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  orderRight: { alignItems: "flex-end", maxWidth: 104 },
  orderTotal: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  statusPill: {
    backgroundColor: colors.greenSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: 6,
  },
  statusPillText: { fontSize: 9.5, fontWeight: "700", color: colors.green, textAlign: "center" },

  timeline: { flexDirection: "row", marginTop: spacing.xl },
  timelineStep: { flex: 1, alignItems: "center" },
  timelineBar: {
    position: "absolute",
    top: 13,
    right: "50%",
    left: "-50%",
    height: 2,
    backgroundColor: colors.track,
  },
  timelineBarDone: { backgroundColor: colors.green },
  timelineDot: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: { backgroundColor: colors.greenMid },
  timelineDotCurrent: { backgroundColor: colors.green },
  timelineLabel: { fontSize: 9.5, color: colors.inkMuted, marginTop: 6, fontWeight: "600" },
  timelineLabelCurrent: { color: colors.green, fontWeight: "800" },

  tileRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tile: {
    flex: 1,
    aspectRatio: 0.86,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 2,
  },
  tileLabel: { fontSize: 9.5, fontWeight: "600", color: colors.ink, textAlign: "center", lineHeight: 12 },
  offersTile: {
    flex: 1.9,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: "center",
    overflow: "hidden",
  },
  offersChevron: { position: "absolute", top: spacing.md, right: spacing.sm, zIndex: 2 },
  offersText: { width: "78%" },
  offersTitle: { color: colors.onDark, fontSize: 13.5, fontWeight: "700", lineHeight: 18 },
  offersCount: { color: colors.onDarkMuted, fontSize: 10, marginTop: 4 },
  offersGift: { position: "absolute", right: -6, bottom: -8, fontSize: 44, opacity: 0.9 },

  infoStrip: {
    flexDirection: "row",
    backgroundColor: colors.greenSoft,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoCell: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 5 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 10, fontWeight: "700", color: colors.ink },
  infoSub: { fontSize: 9, color: colors.inkMuted, marginTop: 1, lineHeight: 12 },
});
