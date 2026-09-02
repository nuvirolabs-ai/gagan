import type {
  HomeActiveOrder,
  HomeCredit,
  HomeLastOrder,
  HomeProductGroup,
  HomeScheme,
} from "../types/home";
import { inr } from "../theme";
import type { CartLine } from "../types";

export type HeaderKind = "active_order" | "scheme" | "stock_up";

export interface HeaderCopy {
  kind: HeaderKind;
  subtitle: string;
  deliveryCue: string | null;
}

export type HeroKind = "scheme" | "active_order" | "assortment";

export interface HeroModel {
  kind: HeroKind;
  kicker: string;
  title: string;
  foot: string | null;
  cta: "products" | "order";
  orderId?: string;
  imageUrl: string | null;
  progressPct?: number;
}

export type AccountKind = "due" | "clear" | "unavailable";

export interface AccountModel {
  kind: AccountKind;
  outstanding: number | null;
  overdue: number | null;
  available: number | null;
}

export function homeSurface(loading: boolean, data: unknown | null): "skeleton" | "error" | "ready" {
  if (loading && data == null) return "skeleton";
  if (data == null) return "error";
  return "ready";
}

export function greetingForHour(hour: number): "home.goodMorning" | "home.goodAfternoon" | "home.goodEvening" {
  if (hour < 12) return "home.goodMorning";
  if (hour < 17) return "home.goodAfternoon";
  return "home.goodEvening";
}

export function formatDeliveryWhen(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const time = at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startAt = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const dayDelta = Math.round((startAt.getTime() - startToday.getTime()) / 86_400_000);

  if (dayDelta === 0) return `Today, ${time}`;
  if (dayDelta === 1) return "Tomorrow";
  return at.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function headerCopy(input: {
  activeOrder: HomeActiveOrder | null;
  scheme: HomeScheme | null;
  now?: Date;
}): HeaderCopy {
  const when = input.activeOrder
    ? formatDeliveryWhen(input.activeOrder.expectedDeliveryAt, input.now)
    : null;
  const deliveryCue = when ? `Next delivery · ${when}` : null;

  if (input.activeOrder) {
    return { kind: "active_order", subtitle: "home.orderOnTheWay", deliveryCue };
  }
  if (input.scheme && input.scheme.remaining > 0) {
    return {
      kind: "scheme",
      subtitle: "home.schemeAway",
      deliveryCue: null,
    };
  }
  return { kind: "stock_up", subtitle: "home.readyToStock", deliveryCue: null };
}

export function selectHero(input: {
  scheme: HomeScheme | null;
  activeOrder: HomeActiveOrder | null;
  productGroups: HomeProductGroup[];
  now?: Date;
}): HeroModel | null {
  const imageFromCatalog =
    input.productGroups.find((group) => group.imageUrl)?.imageUrl ??
    input.productGroups[0]?.imageUrl ??
    null;

  if (input.scheme) {
    const pct = input.scheme.targetAmount > 0
      ? Math.min(100, (input.scheme.progress / input.scheme.targetAmount) * 100)
      : 0;
    const unlocked = input.scheme.remaining <= 0;
    return {
      kind: "scheme",
      kicker: input.scheme.name,
      title: input.scheme.headline,
      foot: unlocked
        ? `Unlocked — ${inr(input.scheme.discountAmount)} benefit earned`
        : `${inr(input.scheme.remaining)} more to unlock`,
      cta: "products",
      imageUrl: imageFromCatalog,
      progressPct: pct,
    };
  }

  if (input.activeOrder) {
    const arriving = formatDeliveryWhen(input.activeOrder.expectedDeliveryAt, input.now);
    return {
      kind: "active_order",
      kicker: "Your order",
      title: arriving ? `Arriving ${arriving.toLowerCase()}` : "Your order is on the way",
      foot: inr(input.activeOrder.orderTotal),
      cta: "order",
      orderId: input.activeOrder.id,
      imageUrl: imageFromCatalog,
    };
  }

  const featured = input.productGroups.find((group) => group.imageUrl) ?? input.productGroups[0];
  if (!featured) return null;

  return {
    kind: "assortment",
    kicker: featured.category,
    title: `Shop ${featured.name}`,
    foot: null,
    cta: "products",
    imageUrl: featured.imageUrl,
  };
}

export function accountModel(credit: HomeCredit | null | undefined): AccountModel {
  if (!credit) {
    return { kind: "unavailable", outstanding: null, overdue: null, available: null };
  }
  if (credit.outstanding <= 0) {
    return {
      kind: "clear",
      outstanding: 0,
      overdue: credit.overdue,
      available: credit.available,
    };
  }
  return {
    kind: "due",
    outstanding: credit.outstanding,
    overdue: credit.overdue,
    available: credit.available,
  };
}

export function currentSkuPrice(groups: HomeProductGroup[], variantId: string): number | null {
  for (const group of groups) {
    const sku = group.skus.find((item) => item.id === variantId);
    if (sku) return sku.price ?? null;
  }
  return null;
}

export function groupNameForSku(groups: Array<{ name: string; skus: Array<{ id: string }> }>, variantId: string): string {
  return groups.find((group) => group.skus.some((sku) => sku.id === variantId))?.name ?? "Product";
}

/**
 * Cart lines for Order Again. Historic last-order prices are ignored;
 * live catalog prices on the product groups win.
 */
export function reorderLines(
  lastOrder: HomeLastOrder | null | undefined,
  groups: HomeProductGroup[]
): CartLine[] {
  if (!lastOrder) return [];
  const lines: CartLine[] = [];
  for (const item of lastOrder.items) {
    const price = currentSkuPrice(groups, item.variantId);
    if (price == null || item.qty <= 0) continue;
    lines.push({
      variantId: item.variantId,
      productName: groupNameForSku(groups, item.variantId) || item.name,
      packSize: item.packDetail,
      unitPrice: price,
      qty: item.qty,
    });
  }
  return lines;
}

export function featuredGroup(groups: HomeProductGroup[]): HomeProductGroup | null {
  if (groups.length === 0) return null;
  return groups.find((group) => group.imageUrl) ?? groups[0];
}

const TIMELINE = ["confirmed", "packed", "out_for_delivery", "delivered"] as const;

export function activeOrderStepIndex(status: string): number {
  if (status === "placed" || status === "confirmed") return 0;
  return TIMELINE.indexOf(status as (typeof TIMELINE)[number]);
}

export function isActiveOrderStatus(status: string): boolean {
  return status === "placed" || status === "confirmed" || status === "packed" || status === "out_for_delivery";
}

export { TIMELINE };
