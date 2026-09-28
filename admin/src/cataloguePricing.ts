export function priceFromDiscount(listRate: number, discountPercent: number) {
  return Math.round(listRate * (100 - discountPercent)) / 100;
}

export function discountFromPrice(listRate: number, tierPrice: number) {
  if (!(listRate > 0)) return null;
  return Math.round((1 - tierPrice / listRate) * 10000) / 100;
}
