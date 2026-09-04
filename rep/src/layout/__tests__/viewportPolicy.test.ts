import { describe, expect, it } from "vitest";
import {
  bottomInsetPolicy,
  SCREEN_CONTENT_BOTTOM_GAP,
  TAB_NAVIGATION_MODEL,
} from "../viewportPolicy";

describe("bottom viewport policy", () => {
  it("lets the normal-flow navigator own the tab-bar rectangle", () => {
    const policy = bottomInsetPolicy({
      model: TAB_NAVIGATION_MODEL,
      tabBarHeight: 78,
      safeAreaBottom: 24,
    });

    expect(policy.owner).toBe("navigator");
    expect(policy.rootPaddingBottom).toBe(0);
    expect(policy.contentPaddingBottom).toBe(SCREEN_CONTENT_BOTTOM_GAP);
  });

  it("does not change normal-flow content when the measured bar changes", () => {
    const compact = bottomInsetPolicy({
      model: TAB_NAVIGATION_MODEL,
      tabBarHeight: 52,
      safeAreaBottom: 0,
    });
    const tall = bottomInsetPolicy({
      model: TAB_NAVIGATION_MODEL,
      tabBarHeight: 96,
      safeAreaBottom: 34,
    });

    expect(compact).toEqual(tall);
    expect(compact.contentPaddingBottom).toBe(SCREEN_CONTENT_BOTTOM_GAP);
  });

  it("keeps overlay behaviour explicit for a future overlay navigator", () => {
    const policy = bottomInsetPolicy({
      model: "absolute-overlay",
      tabBarHeight: 78,
      safeAreaBottom: 24,
      contentGap: 20,
    });

    expect(policy.owner).toBe("scroll-content");
    expect(policy.rootPaddingBottom).toBe(0);
    expect(policy.contentPaddingBottom).toBe(122);
  });
});
