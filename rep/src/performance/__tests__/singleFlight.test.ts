import { describe, expect, it, vi } from "vitest";

import { createSingleFlight } from "../singleFlight";

describe("createSingleFlight", () => {
  it("shares one in-flight task across concurrent callers", async () => {
    const gate = createSingleFlight();
    const task = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

    await Promise.all([gate(task), gate(task), gate(task)]);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("allows a later refresh after the previous task settles", async () => {
    const gate = createSingleFlight();
    const task = vi.fn(async () => undefined);

    await gate(task);
    await gate(task);

    expect(task).toHaveBeenCalledTimes(2);
  });
});
