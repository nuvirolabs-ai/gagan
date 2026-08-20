export type RolloutResult = "allowed" | "approval_required" | "blocked";

export function resolveRolloutDecision(input: {
  mode: "shadow" | "enforce";
  policySigned: boolean;
  legacyResult: "allowed" | "blocked";
  engineResult: RolloutResult;
}) {
  const mode = input.mode === "enforce" && input.policySigned ? "enforce" : "shadow";
  return {
    effectiveResult: mode === "enforce" ? input.engineResult : input.legacyResult,
    mismatch: input.legacyResult !== input.engineResult,
    mode,
  } as const;
}
