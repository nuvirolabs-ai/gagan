export type CollectionRetailer = { id: string; name: string; phone: string; shopAddress: string };

export function filterCollectionRetailers(retailers: CollectionRetailer[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return retailers;
  return retailers.filter((retailer) =>
    [retailer.name, retailer.phone, retailer.shopAddress]
      .some((value) => value?.toLocaleLowerCase().includes(term))
  );
}
