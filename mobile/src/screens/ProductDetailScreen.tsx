import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { colors, radius, spacing, inr } from "../theme";
import ProductThumb from "../components/ProductThumb";
import { QtyStepper, EmptyState, ScreenSkeleton, SectionTitle } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProductDetailScreen({ route, navigation }: any) {
  const { productId } = route.params;
  const { lines, addLine, updateQty } = useCart();
  const { t } = useLanguage();
  const [product, setProduct] = useState<any | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [config, setConfig] = useState<any>({ freeDeliveryThreshold: 0, minOrderValue: 0 });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    api
      .getProduct(productId)
      .then((res) => {
        setProduct(res);
        // The API groups every pack of this product onto one page and says
        // which one was asked for, so following a link to a specific pack
        // opens here with that pack chosen rather than on a duplicate page.
        const requested =
          res.variants.find((variant: any) => variant.id === res.selectedVariantId) ??
          res.variants[0] ??
          null;
        setSelected(requested);
        setConfig(res.config ?? {});
      })
      .catch(() => {
        setProduct(null);
        setLoadError(true);
      });
  }, [productId]);

  if (loadError) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="alert-circle-outline"
          title={t("product.loadError")}
          body={t("errors.checkConnection")}
          actionLabel={t("common.retry")}
          onAction={() => {
            setLoadError(false);
            api
              .getProduct(productId)
              .then((res) => {
                setProduct(res);
                setSelected(
                  res.variants.find((variant: any) => variant.id === res.selectedVariantId) ??
                    res.variants[0] ??
                    null
                );
                setConfig(res.config ?? {});
              })
              .catch(() => setLoadError(true));
          }}
        />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <ScreenSkeleton featured rows={3} />
      </View>
    );
  }

  const inCart = selected ? (lines.find((l) => l.variantId === selected.id)?.qty ?? 0) : 0;

  const setQty = (next: number) => {
    if (!selected || selected.price == null) return;
    const orderable = selected.availability?.status === "available" && Number(selected.availability.available) > 0;
    if (next > inCart && !orderable) return;
    if (inCart === 0 && next > 0) {
      addLine({
        variantId: selected.id,
        productName: product.name,
        packSize: `${selected.unitSize} × ${selected.unitsPerCase}`,
        unitPrice: Number(selected.price),
        qty: next,
      });
    } else {
      updateQty(selected.id, next);
    }
  };

  const lineTotal = selected?.price != null ? Number(selected.price) * Math.max(inCart, 1) : 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ProductThumb
            name={product.name}
            category={product.category}
            imageUrl={product.imageUrl}
            size={168}
          />
        </View>

        <View style={styles.body}>
          <Text style={styles.category}>{product.category.toUpperCase()}</Text>
          <Text style={styles.name}>{product.name}</Text>
          {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

          <SectionTitle>{t("product.packSize")}</SectionTitle>
          <View style={styles.variantRow}>
            {product.variants.map((v: any) => {
              const active = selected?.id === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.variant, active && styles.variantActive]}
                  onPress={() => setSelected(v)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.variantTitle, active && styles.variantTitleActive]}>
                    {v.packLabel ?? v.unitSize}
                  </Text>
                  <Text style={[styles.variantSub, active && styles.variantSubActive]}>
                    {v.packDetail ?? `${v.unitSize} × ${v.unitsPerCase}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selected && (
            <View style={styles.priceBand}>
              <View>
                <Text style={styles.priceLabel}>{t("product.pricePerCase")}</Text>
                <Text
                  style={styles.price}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {selected.price != null ? inr(selected.price) : t("product.onRequest")}
                </Text>
              </View>
              {selected.pricePerKg != null && (
                <View style={styles.perKgBox}>
                  <Text style={styles.perKgValue}>{inr(selected.pricePerKg)}</Text>
                  <Text style={styles.perKgLabel}>{t("product.perKg")}</Text>
                </View>
              )}
            </View>
          )}
          {selected?.isOverride ? (
            <View style={styles.override}>
              <Ionicons name="pricetag" size={11} color={colors.green} />
              <Text style={styles.overrideText}>{t("product.override")}</Text>
            </View>
          ) : null}

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="scale-balance" size={17} color={colors.green} />
              <Text style={styles.infoText}>{t("product.billedWeight")}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="truck" size={16} color={colors.green} />
              <Text style={styles.infoText}>
                {t("product.freeDelivery", { amount: inr(config.freeDeliveryThreshold ?? 0) })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="shopping-bag" size={16} color={colors.green} />
              <Text style={styles.infoText}>
                {t("product.minimumOrder", { amount: inr(config.minOrderValue ?? 0) })}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.barLabel}>{inCart > 0 ? `${inCart} case(s) in cart` : t("product.subtotal")}</Text>
          <Text style={styles.barValue}>{inr(lineTotal)}</Text>
        </View>
        {inCart > 0 ? (
          <View style={styles.barActions}>
            <QtyStepper qty={inCart} onChange={setQty} />
            <TouchableOpacity style={styles.viewCart} onPress={() => navigation.navigate("Main", { screen: "Cart" })}>
              <Text style={styles.viewCartText}>{t("product.viewCart")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, selected?.price == null && styles.addBtnDisabled]}
            disabled={selected?.price == null}
            onPress={() => setQty(1)}
          >
            <Ionicons name="cart-outline" size={17} color={colors.onDark} />
            <Text style={styles.addBtnText}>{t("product.addToCart")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg },

  hero: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    backgroundColor: colors.cream,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
  },
  body: { padding: spacing.lg },
  category: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accentStrong,
    letterSpacing: 0.8,
  },
  name: { fontSize: 26, fontWeight: "700", color: colors.ink, marginTop: 4 },
  description: { fontSize: 14, color: colors.inkMuted, lineHeight: 20, marginTop: spacing.sm },

  variantRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  variant: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  variantActive: { borderColor: colors.accentPrimary, backgroundColor: colors.accentPrimary },
  variantTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  variantTitleActive: { color: colors.onAccent },
  variantSub: { fontSize: 11, color: colors.inkMuted, marginTop: 1 },
  variantSubActive: { color: colors.accentStrong },

  priceBand: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  priceLabel: { fontSize: 12, color: colors.inkMuted, fontWeight: "600" },
  price: { fontSize: 26, fontWeight: "700", color: colors.ink, marginTop: 2, maxWidth: 200 },
  perKgBox: { alignItems: "flex-end" },
  perKgValue: { fontSize: 15, fontWeight: "700", color: colors.ink },
  perKgLabel: { fontSize: 10, color: colors.inkMuted, marginTop: 1 },
  override: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.sm,
  },
  overrideText: { fontSize: 11.5, color: colors.green, fontWeight: "600" },

  infoList: { marginTop: spacing.lg, gap: spacing.md },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  infoText: { flex: 1, fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  barLabel: { fontSize: 11.5, color: colors.inkMuted },
  barValue: { fontSize: 19, fontWeight: "700", color: colors.ink },
  barActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  viewCart: {
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  viewCartText: { color: colors.onDark, fontWeight: "700", fontSize: 13.5 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 22,
    minHeight: 44,
  },
  addBtnDisabled: { opacity: 0.45 },
  addBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 14.5 },
});
