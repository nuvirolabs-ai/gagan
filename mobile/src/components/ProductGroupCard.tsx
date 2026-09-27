import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import ProductThumb from "./ProductThumb";
import { catalogPricePresentation } from "../lib/catalogPricePresentation";
import { QtyStepper } from "./ui";
import { colors, radius, spacing, shadow } from "../theme";

/**
 * One logical product, with its packs.
 *
 * A shopper picks the pack here instead of opening three near-identical
 * products to find the size they want. The SKU behind the chosen pack is still
 * the order unit: price, stock and the cart line all follow the selection, and
 * the line stored is the variant id the backend priced.
 */
export interface Sku {
  id: string;
  /** The product this SKU belongs to — unchanged, and still its ERP identity. */
  productId: string;
  packLabel: string;
  packDetail: string;
  unitSize: string;
  unitsPerCase: number;
  price: number | null;
  caseWeightKg?: number | null;
  pricePerKg?: number | null;
  commercialRate?: number | null;
  rateBasis?: string;
  rateLabel?: string | null;
  catalogStatus?: string;
  orderable?: boolean;
  gstPending?: boolean;
  taxStatus?: "PENDING" | "READY" | "NOT_READY";
  orderingStatus?: string;
  orderingReason?: string | null;
  availability?: { status?: string; available?: number | null } | null;
  imageUrl?: string | null;
  imageStatus?: "exact" | "placeholder" | "pending";
  imageLabel?: string | null;
}

export interface ProductGroupLike {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  skus: Sku[];
  hasMultiplePacks: boolean;
}

function isOrderable(sku: Sku | undefined): boolean {
  if (!sku || sku.price == null) return false;
  if (sku.orderable === false) return false;
  const availability = sku.availability;
  // Unknown stock is not a promise of stock, but it is not a block either:
  // the API says "unknown" when no warehouse feed covers the item.
  if (!availability || availability.status == null || availability.status === "unknown") return true;
  return availability.status === "available" && Number(availability.available ?? 0) > 0;
}

export default function ProductGroupCard({
  group,
  qtyFor,
  onChangeQty,
  onOpen,
  compact,
  appearance = "card",
  orderingDisabled = false,
}: {
  group: ProductGroupLike;
  qtyFor: (variantId: string) => number;
  onChangeQty: (sku: Sku, next: number) => void;
  onOpen?: () => void;
  compact?: boolean;
  /** Home merchandising: featured wash or compact row. Catalog keeps "card". */
  appearance?: "card" | "featured" | "row";
  orderingDisabled?: boolean;
}) {
  // A pack the shopper already has in the cart is the one they mean; otherwise
  // start on the first orderable pack rather than a sold-out one.
  const initial = useMemo(() => {
    const inCart = group.skus.find((sku) => qtyFor(sku.id) > 0);
    return (inCart ?? group.skus.find(isOrderable) ?? group.skus[0])?.id ?? null;
  }, [group.skus, qtyFor]);

  const [selectedId, setSelectedId] = useState<string | null>(initial);
  const selected = group.skus.find((sku) => sku.id === selectedId) ?? group.skus[0];
  const qty = selected ? qtyFor(selected.id) : 0;
  const orderable = isOrderable(selected);
  const priceDisplay = catalogPricePresentation(selected);
  const row = appearance === "row";
  const featured = appearance === "featured";
  const aligned = row || featured;
  const thumb = row ? 84 : featured ? 96 : compact ? 60 : 72;

  return (
    <View style={[styles.card, compact && styles.cardCompact, featured && styles.cardFeatured, row && styles.cardRow]}>
      <View style={styles.mainRow} accessibilityLabel="Product and action">
        <TouchableOpacity
          activeOpacity={onOpen ? 0.85 : 1}
          onPress={onOpen}
          disabled={!onOpen}
          style={[styles.head, row && styles.headRow]}
        >
          <ProductThumb
            name={group.name}
            category={group.category}
            imageUrl={selected?.imageStatus === "placeholder" || selected?.imageStatus === "pending" ? null : selected?.imageUrl ?? group.imageUrl}
            imageStatus={selected?.imageStatus}
            imageLabel={selected?.imageLabel}
            size={thumb}
          />
          <View style={styles.details}>
            <Text style={[styles.name, row && styles.nameRow, featured && styles.nameFeatured]} numberOfLines={aligned ? undefined : 2}>
              {group.name}
            </Text>
            <Text style={[styles.pack, row && styles.packRowText]} numberOfLines={aligned ? 2 : 1}>
              {selected ? selected.packDetail : "—"}
            </Text>
            <Text style={[styles.price, row && styles.priceRow]} numberOfLines={aligned ? undefined : 1} adjustsFontSizeToFit={!aligned} minimumFontScale={0.8}>
              {priceDisplay.primary}
            </Text>
            {priceDisplay.perKg ? <Text style={[styles.rateLabel, row && styles.rateLabelRow]}>{priceDisplay.perKg}</Text> : null}
            {priceDisplay.caseEquivalent ? <Text style={[styles.rateLabel, row && styles.rateLabelRow]}>{priceDisplay.caseEquivalent}</Text> : null}
            {selected?.rateBasis?.toLowerCase() === "quintal" || selected?.rateLabel ? <Text style={[styles.rateLabel, row && styles.rateLabelRow]}>Excluding GST</Text> : null}
            {selected?.gstPending || selected?.taxStatus === "PENDING" ? <Text style={styles.outOfStock}>GST pending — final tax will be applied before invoicing.</Text> : null}
            {!orderable && selected ? <Text style={styles.outOfStock}>{selected.orderingReason ?? "Out of stock"}</Text> : null}
          </View>
        </TouchableOpacity>
        {aligned ? <View style={styles.actionSlot} accessibilityLabel="Quantity action position">
          {selected && orderable && qty === 0 ? <QtyStepper qty={0} onChange={(next) => onChangeQty(selected, next)} compact disabled={orderingDisabled} /> : null}
        </View> : null}
      </View>

      {group.hasMultiplePacks ? (
        <View style={[styles.packRow, row && styles.packRowIndented, featured && styles.packRowFeatured]}>
          {group.skus.map((sku) => {
            const active = sku.id === selected?.id;
            return (
              <TouchableOpacity
                key={sku.id}
                style={[styles.packChip, row && styles.packChipRow, active && styles.packChipActive]}
                onPress={() => setSelectedId(sku.id)}
                accessibilityLabel={`${group.name} ${sku.packLabel}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.packChipText, active && styles.packChipTextActive]}>
                  {sku.packLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {selected && orderable && (qty > 0 || !aligned) ? (
        <View style={styles.expandedControls} accessibilityLabel="Expanded quantity controls">
          <QtyStepper qty={qty} onChange={(next) => onChangeQty(selected, next)} compact disabled={orderingDisabled} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardCompact: { padding: spacing.sm + 2 },
  cardFeatured: {
    backgroundColor: colors.cream,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    padding: spacing.md,
  },
  cardRow: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingRight: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  nameFeatured: { fontSize: 16 },
  packChipRow: { minHeight: 40, paddingVertical: 9, paddingHorizontal: 13 },
  mainRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  head: { flex: 1, minWidth: 0, flexDirection: "row", gap: spacing.md, alignItems: "center" },
  headRow: { minHeight: 96, alignItems: "flex-start" },
  details: { flex: 1, minWidth: 0 },
  actionSlot: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  nameRow: { fontSize: 16, lineHeight: 21 },
  pack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  packRowText: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  price: { fontSize: 13.5, fontWeight: "700", color: colors.ink, marginTop: 4 },
  priceRow: { fontSize: 16, lineHeight: 21, marginTop: 6 },
  outOfStock: { fontSize: 11, fontWeight: "700", color: colors.warning, marginTop: 2 },
  rateLabel: { fontSize: 10.5, color: colors.inkMuted, marginTop: 1 },
  rateLabelRow: { fontSize: 11.5, lineHeight: 16 },

  packRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  packRowIndented: { marginLeft: 84 + spacing.md },
  packRowFeatured: { marginLeft: 96 + spacing.md },
  packChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  // The chosen pack uses the warm accent as a fill with dark ink on top, which
  // is legible where the accent as text would not be.
  packChipActive: { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
  packChipText: { fontSize: 13, fontWeight: "700", color: colors.inkMuted },
  packChipTextActive: { color: colors.onAccent },

  expandedControls: { flexDirection: "row", justifyContent: "flex-end" },
});
