import { describe, expect, it } from "vitest";
import {
  colors,
  composeGreeting,
  contrastRatio,
  FILTER_CHIP_HEIGHT,
  FILTER_ROW_HEIGHT,
  greetingForHour,
  headerInsetTop,
  initials,
  metricColumnCount,
  spacing,
} from "../theme";

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

  it("keeps semantic aliases pointing at the same palette", () => {
    expect(colors.canvas).toBe(colors.bg);
    expect(colors.primaryDeep).toBe(colors.greenDeep);
    expect(colors.goldStrong).toBe(colors.accentStrong);
  });
});

describe("companion helpers", () => {
  it("builds two-letter initials", () => {
    expect(initials("Ravi Kumar")).toBe("RK");
    expect(initials("Annapurna Foods")).toBe("AF");
  });

  it("splits the day into morning, afternoon and evening", () => {
    expect(greetingForHour(8)).toBe("morning");
    expect(greetingForHour(14)).toBe("afternoon");
    expect(greetingForHour(20)).toBe("evening");
  });

  it("composes a greeting with the first name only once", () => {
    expect(composeGreeting("Good morning", "Ravi Kumar")).toBe("Good morning, Ravi");
    expect(composeGreeting("Nice work", "Ravi Kumar")).toBe("Nice work, Ravi");
    expect(composeGreeting("Nice work, Ravi.", "Ravi Kumar")).toBe("Nice work, Ravi");
    expect(composeGreeting("Nice work, Ravi., Ravi", "Ravi Kumar")).toBe("Nice work, Ravi");
    expect(composeGreeting("Good evening", "")).toBe("Good evening");
  });

  it("uses the larger of safe-area and Android status-bar height", () => {
    expect(headerInsetTop(0, 24)).toBe(24 + spacing.md);
    expect(headerInsetTop(48, 24)).toBe(48 + spacing.md);
    expect(headerInsetTop(0, 0)).toBe(spacing.md);
  });

  it("wraps KPI grids on narrow phones and long labels", () => {
    expect(metricColumnCount(360, 3, 18)).toBe(2);
    expect(metricColumnCount(360, 6, 18)).toBe(2);
    expect(metricColumnCount(420, 3, 6)).toBe(3);
    expect(metricColumnCount(420, 4, 11)).toBe(2);
  });

  it("keeps filter chips at a stable pill height", () => {
    expect(FILTER_CHIP_HEIGHT).toBeGreaterThanOrEqual(36);
    expect(FILTER_CHIP_HEIGHT).toBeLessThanOrEqual(44);
    expect(FILTER_ROW_HEIGHT).toBe(44);
    expect(FILTER_ROW_HEIGHT).toBeGreaterThanOrEqual(FILTER_CHIP_HEIGHT);
    expect(FILTER_ROW_HEIGHT).toBeLessThanOrEqual(48);
  });
});
