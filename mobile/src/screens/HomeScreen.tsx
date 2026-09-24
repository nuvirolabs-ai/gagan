import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "../api/client";
import { HomePayload, HomeProductGroup } from "../types/home";
import { useCart } from "../context/CartContext";
import { colors, radius, spacing, inr, tabBarContentSpace } from "../theme";
import ProductGroupCard, { type ProductGroupLike, type Sku } from "../components/ProductGroupCard";
import HomeSkeleton from "../components/home/HomeSkeleton";
import RetailerPromoCarousel from "../components/home/RetailerPromoCarousel";
import AccountStrip from "../components/home/AccountStrip";
import { useLanguage } from "../i18n/LanguageContext";
import { formatOrderRef } from "../lib/orderRef";
import {
  accountModel,
  featuredGroup,
  formatDeliveryWhen,
  greetingForHour,
  groupNameForSku,
  headerCopy,
  reorderLines,
} from "../lib/homePresentation";
import { buildRetailerPromotions, promotionDestination } from "../lib/retailerPromotions";
import { canChangeCatalogQuantity } from "../lib/catalogInteractions";
import { homeProductPreview } from "../lib/homeProductPreview";

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
export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 360;
  const { lines, addLine, updateQty } = useCart();
  const cartCount = lines.reduce((count, line) => count + line.qty, 0);
  const { t } = useLanguage();
  const [data, setData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financeStale, setFinanceStale] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const dataRef = useRef<HomePayload | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  dataRef.current = data;
  const promotions = useMemo(() => buildRetailerPromotions(data?.productGroups ?? []), [data?.productGroups]);

  const load = useCallback(async () => {
    const res = await api.getHome();
    setData(res);
    setFinanceStale(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const hasData = dataRef.current != null;
      if (!hasData) setLoading(true);
      load()
        .catch(() => {
          if (!cancelled) {
            if (!dataRef.current) setData(null);
            else setFinanceStale(true);
          }
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
    await load().catch(() => { setFinanceStale(true); });
    setRefreshing(false);
  };

  const qtyFor = (variantId: string) => lines.find((l) => l.variantId === variantId)?.qty ?? 0;

  if (loading && !data) {
    return <HomeSkeleton top={insets.top + spacing.sm} bottomSpace={tabBarContentSpace(cartCount)} />;
  }
  if (!data) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>{t("home.loadError")}</Text>
        <Text style={styles.errorBody}>{t("errors.checkConnection")}</Text>
        <TouchableOpacity style={styles.retry} onPress={onRefresh} accessibilityRole="button">
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { retailer, salesRep, scheme, activeOrder, config } = data;
  const lastOrder = data.lastOrder ?? null;
  const credit = data.credit;
  const categories = data.categories ?? [];
  const productGroups: HomeProductGroup[] = data.productGroups ?? [];
  const visibleGroups = productGroups.filter(
    (group) => selectedCategory === ALL_CATEGORY || group.category === selectedCategory
  );
  const featured = featuredGroup(visibleGroups);
  const shelf = visibleGroups.filter((group) => group.id !== featured?.id);
  const previewShelf = homeProductPreview(shelf);
  // Product discovery owns the primary Home real estate. Order status is
  // intentionally rendered as a compact secondary row below the promotions.
  const header = headerCopy({ activeOrder: null, scheme });
  const account = accountModel(credit);
  const hour = new Date().getHours();
  const arriving = formatDeliveryWhen(activeOrder?.expectedDeliveryAt);
  const addableUsual = reorderLines(lastOrder, productGroups);

  const setSkuQty = (sku: Sku, next: number) => {
    const current = qtyFor(sku.id);
    if (!canChangeCatalogQuantity(sku, current, next)) return;
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

  const addLastOrder = () => {
    addableUsual.forEach((line) => addLine(line));
    navigation.navigate("Cart");
  };

  const openProduct = (group: ProductGroupLike) => {
    const productId = group.skus[0]?.productId;
    if (productId) navigation.navigate("ProductDetail", { productId });
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: tabBarContentSpace(cartCount) + 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.wordmark}>
            GAGA<Text style={{ color: colors.green }}>N</Text>
          </Text>
          {config.supportPhone ? (
            <TouchableOpacity
              style={styles.iconBtn}
              accessibilityLabel={t("profile.support")}
              onPress={() => Linking.openURL(`tel:${config.supportPhone}`)}
            >
              <MaterialCommunityIcons name="headset" size={18} color={colors.ink} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.greet}>{t(greetingForHour(hour))}</Text>
        <Text
          style={[styles.store, narrow && styles.storeNarrow]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {retailer.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {header.kind === "scheme"
            ? t("home.schemeAway", { amount: inr(scheme?.remaining ?? 0) })
            : t(header.subtitle)}
        </Text>
      </View>

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

      <RetailerPromoCarousel
        promotions={promotions}
        onPress={(promotion) => {
          const destination = promotionDestination(promotion);
          navigation.navigate(destination.screen, destination.params);
        }}
      />

      {/* Account finance */}
      <View style={styles.sectionSpace}>
        <AccountStrip
          account={account}
          onPay={() => navigation.navigate("Pay")}
          onLedger={() => navigation.navigate("Ledger")}
        />
        {financeStale ? <Text style={styles.financeStale}>Account totals may be out of date. Pull to refresh.</Text> : null}
      </View>

      {/* Shop by category */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("home.shopByCategory")}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {[ALL_CATEGORY, ...categories].map((value) => {
          const active = selectedCategory === value;
          const label = value === ALL_CATEGORY ? t("home.allCategories") : CATEGORY_LABELS[value] ?? value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedCategory(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Products */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === ALL_CATEGORY
            ? t("home.products")
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
          <>
            {featured ? (
              <ProductGroupCard
                key={featured.id}
                group={featured}
                qtyFor={qtyFor}
                onChangeQty={setSkuQty}
                onOpen={() => openProduct(featured)}
                appearance="featured"
              />
            ) : null}
            {previewShelf.map((group) => (
              <ProductGroupCard
                key={group.id}
                group={group}
                qtyFor={qtyFor}
                onChangeQty={setSkuQty}
                onOpen={() => openProduct(group)}
                appearance="row"
              />
            ))}
          </>
        )}
      </View>

      {/* Latest order */}
      {activeOrder ? (
        <TouchableOpacity
          style={styles.latestOrder}
          activeOpacity={0.88}
          onPress={() => navigation.navigate("OrderDetail", { orderId: activeOrder.id })}
          accessibilityRole="button"
          accessibilityLabel={`${t("home.yourOrder")} ${formatOrderRef(activeOrder)}`}
        >
          <View style={styles.latestOrderCopy}>
            <Text style={styles.latestOrderLabel}>Latest order</Text>
            <Text style={styles.latestOrderId} numberOfLines={1}>{formatOrderRef(activeOrder)}</Text>
            <Text style={styles.latestOrderMeta} numberOfLines={1}>
              {arriving ? t("home.arriving", { when: arriving }) : t("home.orderOnTheWay")}
            </Text>
          </View>
          <Text style={styles.latestOrderTotal}>{inr(activeOrder.orderTotal)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
        </TouchableOpacity>
      ) : null}

      {/* Order again */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("home.orderAgain")}</Text>
      </View>
      {lastOrder && addableUsual.length > 0 ? (
        <View style={styles.usual}>
          {lastOrder.items.map((item) => {
            const live = addableUsual.find((line) => line.variantId === item.variantId);
            if (!live) return null;
            return (
              <View key={item.variantId} style={styles.usualRow}>
                <Text style={styles.usualName} numberOfLines={1}>
                  {live.productName}
                </Text>
                <Text style={styles.usualQty}>
                  {t("home.cases", { count: item.qty })}
                </Text>
              </View>
            );
          })}
          <TouchableOpacity
            style={styles.usualBtn}
            onPress={addLastOrder}
            accessibilityRole="button"
            accessibilityLabel={t("home.addLastOrder")}
          >
            <Text style={styles.usualBtnText}>{t("home.addLastOrder")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.quietEmpty}>
          <Text style={styles.quietTitle}>{t("home.noOrderHistory")}</Text>
          <Text style={styles.quietBody}>{t("home.noOrderHistoryBody")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Products")}>
            <Text style={styles.link}>{t("home.viewProducts")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {salesRep ? (
        <View style={styles.support}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.supportLabel}>{t("home.salesman")}</Text>
            <Text style={styles.supportName} numberOfLines={1}>
              {salesRep.name}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.supportCall}
            accessibilityLabel={t("home.callSalesperson", { name: salesRep.name })}
            onPress={() => Linking.openURL(`tel:${salesRep.phone}`)}
          >
            <Ionicons name="call" size={16} color={colors.onDark} />
            <Text style={styles.supportCallText}>{t("home.call")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  rowCenter: { flexDirection: "row", alignItems: "center" },

  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  wordmark: { fontSize: 13, fontWeight: "800", color: colors.green, letterSpacing: 1.6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  greet: { fontSize: 14, color: colors.inkMuted, fontWeight: "500" },
  store: { fontSize: 26, fontWeight: "700", color: colors.ink, marginTop: 2 },
  storeNarrow: { fontSize: 22 },
  subtitle: { fontSize: 14, color: colors.ink, marginTop: 6, fontWeight: "500", lineHeight: 20 },

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
    minHeight: 44,
    marginBottom: spacing.md,
  },
  searchPlaceholder: { fontSize: 14, color: colors.inkFaint },

  latestOrder: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  latestOrderCopy: { flex: 1, minWidth: 0 },
  latestOrderLabel: { fontSize: 10.5, fontWeight: "800", color: colors.accentStrong, textTransform: "uppercase", letterSpacing: 0.6 },
  latestOrderId: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 2 },
  latestOrderMeta: { fontSize: 11.5, color: colors.inkMuted, marginTop: 1 },
  latestOrderTotal: { fontSize: 14, fontWeight: "800", color: colors.ink, maxWidth: 88, textAlign: "right" },

  sectionSpace: { marginTop: spacing.md },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.inkMuted, letterSpacing: 0.6, textTransform: "uppercase" },
  link: { fontSize: 13, fontWeight: "600", color: colors.green },

  usual: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg, gap: 8 },
  usualRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  usualName: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  usualQty: { fontSize: 13, color: colors.inkMuted, fontWeight: "600", flexShrink: 0 },
  usualBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  usualBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 14 },

  quietEmpty: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg, gap: 4 },
  quietTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  quietBody: { fontSize: 13, color: colors.inkMuted, lineHeight: 18 },

  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
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

  productList: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  emptyProducts: { fontSize: 13, color: colors.inkMuted, paddingVertical: spacing.lg },


  support: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  supportLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: "600" },
  supportName: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 1 },
  supportCall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  supportCallText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },

  errorTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, textAlign: "center" },
  errorBody: { fontSize: 13.5, color: colors.inkMuted, marginTop: 6, textAlign: "center" },
  financeStale: { marginHorizontal: spacing.lg, color: colors.inkMuted, fontSize: 12, marginBottom: spacing.sm },
  retry: {
    marginTop: spacing.lg,
    backgroundColor: colors.green,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: { color: colors.onDark, fontWeight: "700" },
});
