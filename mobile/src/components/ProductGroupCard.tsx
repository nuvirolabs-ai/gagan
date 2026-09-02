import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import ProductThumb from "./ProductThumb";
import { QtyStepper } from "./ui";
import { colors, radius, spacing, shadow, inr } from "../theme";

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
  availability?: { status?: string; available?: number | null } | null;
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
}: {
  group: ProductGroupLike;
  qtyFor: (variantId: string) => number;
  onChangeQty: (sku: Sku, next: number) => void;
  onOpen?: () => void;
  compact?: boolean;
  /** Home merchandising: featured wash or compact row. Catalog keeps "card". */
  appearance?: "card" | "featured" | "row";
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
  const row = appearance === "row";
  const featured = appearance === "featured";
  const thumb = row ? 56 : featured ? 96 : compact ? 60 : 72;

  return (
    <View style={[styles.card, compact && styles.cardCompact, featured && styles.cardFeatured, row && styles.cardRow]}>
      <TouchableOpacity
        activeOpacity={onOpen ? 0.85 : 1}
        onPress={onOpen}
        disabled={!onOpen}
        style={styles.head}
      >
        <ProductThumb
          name={group.name}
          category={group.category}
          imageUrl={group.imageUrl}
          size={thumb}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, featured && styles.nameFeatured]} numberOfLines={2}>
            {group.name}
          </Text>
          <Text style={styles.pack} numberOfLines={1}>
            {selected ? selected.packDetail : "—"}
          </Text>
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {selected?.price != null ? `${inr(selected.price)} / case` : "Price on request"}
          </Text>
          {!orderable && selected ? <Text style={styles.outOfStock}>Out of stock</Text> : null}
        </View>
      </TouchableOpacity>

      {group.hasMultiplePacks ? (
        <View style={styles.packRow}>
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

      <View style={styles.footer}>
        {group.hasMultiplePacks ? (
          <Text style={styles.footNote} numberOfLines={1}>
            <Ionicons name="cube-outline" size={11} color={colors.inkFaint} />{" "}
            {group.skus.length} pack sizes
          </Text>
        ) : (
          <View />
        )}
        {selected && orderable ? (
          <QtyStepper qty={qty} onChange={(next) => onChangeQty(selected, next)} compact />
        ) : (
          <Text style={styles.footNote}>Unavailable</Text>
        )}
      </View>
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
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  nameFeatured: { fontSize: 16 },
  packChipRow: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 12 },
  head: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  name: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  pack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  price: { fontSize: 13.5, fontWeight: "700", color: colors.ink, marginTop: 4 },
  outOfStock: { fontSize: 11, fontWeight: "700", color: colors.warning, marginTop: 2 },

  packRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
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
  packChipText: { fontSize: 12, fontWeight: "700", color: colors.inkMuted },
  packChipTextActive: { color: colors.onAccent },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footNote: { fontSize: 11, color: colors.inkFaint },
});
