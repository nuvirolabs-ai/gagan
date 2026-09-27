export type OwnBeat = { id: string; name: string; stops: Array<{ retailerId: string; sequence: number }> };

export function ownBeatRetailerIds(beats: OwnBeat[], selectedBeatId: string) {
  const selected = selectedBeatId ? beats.filter((beat) => beat.id === selectedBeatId) : beats;
  return new Set(selected.flatMap((beat) => beat.stops.map((stop) => stop.retailerId)));
}
