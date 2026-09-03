import { describe, expect, it } from "vitest";
import { inr, inrCompact } from "../../theme";
import { firstName, initials } from "../format";

describe("ocean home formatting", () => {
  it("uses Indian grouping and compact field figures from the locked mock", () => {
    expect(inr(48750)).toBe("₹48,750");
    expect(inr(64000)).toBe("₹64,000");
    expect(inrCompact(48750)).toBe("₹48.8k");
    expect(inrCompact(221000)).toBe("₹2.21L");
    expect(inrCompact(325000)).toBe("₹3.25L");
  });

  it("shortens staff names for the greeting and avatar", () => {
    expect(firstName("Arjun Mehta")).toBe("Arjun");
    expect(initials("Arjun Mehta")).toBe("AM");
  });
});
