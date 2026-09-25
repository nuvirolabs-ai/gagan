/** Coalesces concurrent reads without caching a result beyond the in-flight request. */
export function createSingleFlight() {
  let inFlight: Promise<void> | null = null;

  return (task: () => Promise<void>): Promise<void> => {
    if (inFlight) return inFlight;

    const run = Promise.resolve().then(task);
    const settled = run.finally(() => {
      if (inFlight === settled) inFlight = null;
    });
    inFlight = settled;
    return settled;
  };
}
