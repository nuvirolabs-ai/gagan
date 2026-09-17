import type { HomeProductGroup, HomeSku } from "../types/home";

export interface RetailerPromotion {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  cta: string;
  category: string;
  imageUrl: string | null;
  imageTreatment: "product" | "category";
  icon: "leaf" | "sparkles" | "nutrition";
}

function exactImageFor(group: HomeProductGroup | undefined): string | null {
  if (!group) return null;
  const exactSku = group.skus.find((sku: HomeSku) => sku.imageStatus === "exact" && sku.imageUrl);
  if (exactSku?.imageUrl) return exactSku.imageUrl;
  // A group with no pack-level metadata can still carry an exact product
  // image from the current Home response.
  if (group.skus.length === 0 && group.imageUrl) return group.imageUrl;
  return null;
}

function categoryGroup(groups: HomeProductGroup[], category: string, nameHint?: string) {
  const candidates = groups.filter((group) => group.category === category);
  if (!nameHint) return candidates[0];
  const lowered = nameHint.toLowerCase();
  return candidates.find((group) => group.name.toLowerCase().includes(lowered)) ?? candidates[0];
}

export function buildRetailerPromotions(groups: HomeProductGroup[]): RetailerPromotion[] {
  const dal = groups.find(
    (group) => group.category === "Daal" && !group.name.toLowerCase().includes("laxmi")
  ) ?? categoryGroup(groups, "Daal");
  const laxmi = groups.find((group) => group.name.toLowerCase().includes("laxmi"));
  const rice = categoryGroup(groups, "Rice") ?? categoryGroup(groups, "Staples");
  const entries = [
    {
      id: "dal-range",
      eyebrow: "Everyday staples",
      title: "Stock up on dals",
      detail: "Reliable packs for your next store order.",
      cta: "View Dals",
      category: "Daal",
      group: dal,
      icon: "leaf" as const,
    },
    {
      id: "laxmi-toor-dal",
      eyebrow: "Trusted choice",
      title: "Laxmi Toor Dal",
      detail: "A familiar staple, ready to reorder.",
      cta: "Shop Laxmi",
      category: "Daal",
      group: laxmi,
      icon: "sparkles" as const,
    },
    {
      id: "rice-whole-grains",
      eyebrow: "Pantry favourites",
      title: "Rice & whole grains",
      detail: "Explore the range by pack size.",
      cta: "Explore Range",
      category: rice?.category ?? "Rice",
      group: rice,
      icon: "nutrition" as const,
    },
  ];

  return entries.map((entry) => {
    const imageUrl = exactImageFor(entry.group);
    return {
      id: entry.id,
      eyebrow: entry.eyebrow,
      title: entry.title,
      detail: entry.detail,
      cta: entry.cta,
      category: entry.category,
      imageUrl,
      imageTreatment: imageUrl ? "product" : "category",
      icon: entry.icon,
    };
  });
}

export function promotionDestination(promotion: Pick<RetailerPromotion, "category">) {
  return { screen: "Products" as const, params: { category: promotion.category } };
}
