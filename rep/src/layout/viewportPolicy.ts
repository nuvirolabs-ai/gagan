import { spacing } from "../theme";

/**
 * The salesperson app uses React Navigation's normal-flow bottom tabs.
 *
 * The navigator owns the tab-bar rectangle. Screens own only a small final
 * content gap so the last interactive row does not touch the bar. Keeping
 * this policy explicit prevents a measured tab-bar height from being added to
 * both the scene and its scroll content again.
 */
export const TAB_NAVIGATION_MODEL = "normal-flow" as const;
export const SCREEN_CONTENT_BOTTOM_GAP = spacing.xl;

export type BottomInsetPolicy = {
  rootPaddingBottom: number;
  contentPaddingBottom: number;
  owner: "navigator" | "scroll-content";
};

export function bottomInsetPolicy(input: {
  model: typeof TAB_NAVIGATION_MODEL | "absolute-overlay";
  tabBarHeight: number;
  safeAreaBottom: number;
  contentGap?: number;
}): BottomInsetPolicy {
  const contentGap = input.contentGap ?? SCREEN_CONTENT_BOTTOM_GAP;

  if (input.model === TAB_NAVIGATION_MODEL) {
    return {
      rootPaddingBottom: 0,
      contentPaddingBottom: contentGap,
      owner: "navigator",
    };
  }

  return {
    rootPaddingBottom: 0,
    contentPaddingBottom: input.tabBarHeight + input.safeAreaBottom + contentGap,
    owner: "scroll-content",
  };
}
