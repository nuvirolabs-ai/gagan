import { describe, expect, it } from "vitest";
import { resolveRolloutDecision } from "../rollout";

describe("credit rollout safety", () => {
  it("records a mismatch but preserves legacy behavior in shadow mode", () => {
    expect(resolveRolloutDecision({ mode: "shadow", policySigned: false, legacyResult: "allowed", engineResult: "blocked" }))
      .toEqual({ effectiveResult: "allowed", mismatch: true, mode: "shadow" });
  });

  it("cannot enforce without signed policy approval", () => {
    expect(resolveRolloutDecision({ mode: "enforce", policySigned: false, legacyResult: "allowed", engineResult: "blocked" }))
      .toEqual({ effectiveResult: "allowed", mismatch: true, mode: "shadow" });
  });

  it("uses the engine only after signed enforcement", () => {
    expect(resolveRolloutDecision({ mode: "enforce", policySigned: true, legacyResult: "allowed", engineResult: "approval_required" }))
      .toEqual({ effectiveResult: "approval_required", mismatch: true, mode: "enforce" });
  });
});
