import { describe, expect, it } from "vitest";
import { approvedCatalogueImage } from "../catalogueVisibility";

describe("approved catalogue image", () => {
  it("accepts an exact image only when an image reference exists", () => {
    expect(approvedCatalogueImage({ catalogImageStatus: "exact", imageUrl: "https://example.test/pack.jpg" })).toBe("exact");
    expect(approvedCatalogueImage({ catalogImageStatus: "exact", imageUrl: null })).toBe("missing");
  });

  it("keeps an explicit placeholder and blocks pending or missing images", () => {
    expect(approvedCatalogueImage({ catalogImageStatus: "placeholder", imageUrl: null })).toBe("placeholder");
    expect(approvedCatalogueImage({ catalogImageStatus: "pending", imageUrl: null })).toBe("missing");
    expect(approvedCatalogueImage({ catalogImageStatus: null, imageUrl: null })).toBe("missing");
  });
});
