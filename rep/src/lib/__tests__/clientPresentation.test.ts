import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sourceRoot = resolve(dirname(import.meta.filename), "../..");

function read(relativePath: string) {
  return readFileSync(resolve(sourceRoot, relativePath), "utf8");
}

describe("client-facing salesperson presentation", () => {
  it("does not expose test-environment or field-operations labels in active surfaces", () => {
    const activeCopy = [
      read("components/ActivityComposer.tsx"),
      read("components/companion.tsx"),
      read("i18n/translations.ts"),
      read("screens/TodayScreen.tsx"),
      read("screens/SalesKitScreen.tsx"),
      read("screens/MarketSurveysScreen.tsx"),
      read("screens/RepAccountScreen.tsx"),
    ].join("\n");

    expect(activeCopy).not.toMatch(/\bUAT\b|FOUNDER UAT|ROUTING-UAT|FIELD OPS/i);
    expect(activeCopy).not.toMatch(/Product demo|FIELD COMPANION|GAGAN FIELD COMPANION|FIELD DAY/i);
    expect(activeCopy).not.toMatch(/\bin field\b|Field expense claims|field updates?/i);
  });
});
