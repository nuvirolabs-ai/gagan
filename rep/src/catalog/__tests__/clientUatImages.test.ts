import { describe, expect, it } from "vitest";
import { CLIENT_UAT_IMAGE_AUDIT, clientUatImageFor, clientUatImageKey } from "../clientUatImages";

describe("Client UAT catalogue image map", () => {
  it("uses the hosted asset for the exact product and pack", () => {
    expect(clientUatImageFor("Gagan Basmati Rice Classic", "5 KG", 4)).toMatch(
      /^https:\/\/gagan-client-uat-api\.onrender\.com\/catalog-images\/real\/[a-f0-9]+\.jpg$/,
    );
    expect(clientUatImageFor("Sehmat Poha", "500 GM", 60)).toMatch(
      /^https:\/\/gagan-client-uat-api\.onrender\.com\/catalog-images\/real\/[a-f0-9]+\.jpg$/,
    );
  });

  it("does not guess for a current pack with no unambiguous historical match", () => {
    expect(clientUatImageFor("Gagan Basmati Rice Classic", "1 KG", 30)).toBeNull();
    expect(clientUatImageFor("Neel Gagan Mung Mogar", "1 KG", 30)).toBeNull();
  });

  it("normalizes the stable lookup key without dropping pack identity", () => {
    expect(clientUatImageKey(" Gagan  Classic ", "5-kg", 4)).toBe("GAGAN CLASSIC|5 KG|4");
    expect(clientUatImageKey("Gagan Classic", "5 KG", 1)).not.toBe(clientUatImageKey("Gagan Classic", "5 KG", 4));
  });

  it("records the complete current UAT audit", () => {
    expect(CLIENT_UAT_IMAGE_AUDIT).toEqual({
      totalSkus: 87,
      uatMappedImages: 57,
      ambiguous: 11,
      missing: 19,
    });
  });
});
