// Home is a discovery surface, not the entire catalogue. Rendering all 52
// image-heavy cards inside a ScrollView caused every Home scroll frame on the
// Moto E13 to miss its budget. Products remains the complete virtualized list.
export const HOME_PRODUCT_PREVIEW_LIMIT = 4;

export function homeProductPreview<T>(groups: T[]): T[] {
  return groups.slice(0, HOME_PRODUCT_PREVIEW_LIMIT);
}
