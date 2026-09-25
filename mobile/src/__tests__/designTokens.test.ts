import { describe, expect, it } from "vitest";
import { colors, contrastRatio } from "../theme";

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and UI boundaries. */
const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe("contrast maths", () => {
  it("agrees with the known extremes", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("the warm accent is legible wherever it is used", () => {
  it("reads as text on the app's own surfaces", () => {
    expect(contrastRatio(colors.accentStrong, colors.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.accentStrong, colors.bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("carries dark text when it is used as a fill", () => {
    expect(contrastRatio(colors.onAccent, colors.accentPrimary)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("is never used as text on white, which it is not light-safe for", () => {
    // Guards the rule the tokens document: accentPrimary fills, never letters.
    expect(contrastRatio(colors.accentPrimary, colors.surface)).toBeLessThan(AA_TEXT);
  });

  it("reads on its own soft surface", () => {
    expect(contrastRatio(colors.ink, colors.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.accentStrong, colors.accentSoft)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe("status colours stay legible and stay distinct", () => {
  it("meets AA on white", () => {
    for (const token of [colors.success, colors.warning, colors.error, colors.info]) {
      expect(contrastRatio(token, colors.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("meets at least large-text contrast on its own soft surface", () => {
    const pairs: Array<[string, string]> = [
      [colors.success, colors.successSoft],
      [colors.warning, colors.warningSoft],
      [colors.error, colors.errorSoft],
      [colors.info, colors.infoSoft],
    ];
    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  it("does not let the accent stand in for a status", () => {
    // Warning must be visibly its own colour, not the celebration gold.
    expect(colors.warning).not.toBe(colors.accentPrimary);
    expect(colors.error).not.toBe(colors.accentPrimary);
    expect(colors.success).not.toBe(colors.accentPrimary);
  });
});

describe("the core reading surfaces", () => {
  it("keep body and muted text legible", () => {
    expect(contrastRatio(colors.ink, colors.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.ink, colors.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(colors.inkMuted, colors.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("keep the primary action readable", () => {
    expect(contrastRatio(colors.onDark, colors.green)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
