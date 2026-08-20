import { afterEach, describe, expect, it } from "vitest";
import { startScheduledJobs } from "../jobs";

describe("startScheduledJobs", () => {
  const original = process.env.DISABLE_JOBS;

  afterEach(() => {
    if (original == null) delete process.env.DISABLE_JOBS;
    else process.env.DISABLE_JOBS = original;
  });

  it("returns a safe cleanup function when jobs are disabled", () => {
    process.env.DISABLE_JOBS = "true";

    const stop = startScheduledJobs();

    expect(stop).toBeTypeOf("function");
    expect(() => stop()).not.toThrow();
  });
});
