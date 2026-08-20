/** Next fixed UTC calendar-quarter boundary: 1 Jan, Apr, Jul or Oct. */
export function nextQuarterlyCheckpoint(after: Date) {
  const year = after.getUTCFullYear();
  for (const month of [0, 3, 6, 9]) {
    const checkpoint = new Date(Date.UTC(year, month, 1));
    if (checkpoint > after) return checkpoint;
  }
  return new Date(Date.UTC(year + 1, 0, 1));
}

export function shouldAdvanceMissedCheckpoint(input: {
  nextReviewAt: Date | null;
  now: Date;
  requiresConfirmation: boolean;
  currentRating: string;
  proposedRating: string;
}) {
  const willQueueConfirmation =
    input.requiresConfirmation && input.proposedRating !== input.currentRating;
  return input.nextReviewAt != null && input.nextReviewAt <= input.now && !willQueueConfirmation;
}
