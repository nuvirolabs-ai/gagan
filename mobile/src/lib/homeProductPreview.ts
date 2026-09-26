import type { HomeProductGroup } from "../types/home";

export const HOME_PRODUCT_PREVIEW_LIMIT = 20;

export function homeProductPreview(groups: HomeProductGroup[]): {
  groups: HomeProductGroup[];
  hasMore: boolean;
} {
  const preview: HomeProductGroup[] = [];
  const total = groups.reduce((count, group) => count + group.skus.length, 0);
  let remaining = HOME_PRODUCT_PREVIEW_LIMIT;

  for (const group of groups) {
    if (remaining === 0) break;
    if (group.skus.length === 0) continue;
    const skus = group.skus.slice(0, remaining);
    preview.push(skus.length === group.skus.length
      ? group
      : { ...group, skus, hasMultiplePacks: skus.length > 1 });
    remaining -= skus.length;
  }

  return { groups: preview, hasMore: total > HOME_PRODUCT_PREVIEW_LIMIT };
}
