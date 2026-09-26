export function toggleBeatRetailer(selected: string[], retailerId: string): string[] {
  return selected.includes(retailerId)
    ? selected.filter((id) => id !== retailerId)
    : [...selected, retailerId];
}
