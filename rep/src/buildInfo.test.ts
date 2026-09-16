import { describe, expect, it } from "vitest";
import { buildApiLabel } from "./buildInfo";

describe("review build identity", () => {
  it("renders a safe hostname label without a protocol or trailing slash", () => {
    expect(buildApiLabel("https://gagan-srat.onrender.com/")).toBe("gagan-srat.onrender.com");
  });

  it("does not expose an empty API label", () => {
    expect(buildApiLabel("https://")).toBe("unconfigured");
    expect(buildApiLabel("")).toBe("unconfigured");
  });
});
