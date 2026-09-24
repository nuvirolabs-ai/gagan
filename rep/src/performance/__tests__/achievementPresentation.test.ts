import { describe, expect, it } from "vitest";

import { shouldPresentAchievementSheet } from "../achievementPresentation";

describe("target achievement presentation", () => {
  it("opens the full sheet for the newly earned 100% target milestone", () => {
    expect(shouldPresentAchievementSheet({ type: "TARGET_100", celebration: "major" })).toBe(true);
  });

  it("keeps the 90% target milestone out of the full achievement sheet", () => {
    expect(shouldPresentAchievementSheet({ type: "TARGET_90", celebration: "minor" })).toBe(false);
  });

  it("preserves full presentation for existing non-target major achievements", () => {
    expect(shouldPresentAchievementSheet({ type: "PERSONAL_BEST", celebration: "major" })).toBe(true);
  });

  it("does not turn other minor milestones into a modal celebration", () => {
    expect(shouldPresentAchievementSheet({ type: "TARGET_75", celebration: "minor" })).toBe(false);
  });
});
