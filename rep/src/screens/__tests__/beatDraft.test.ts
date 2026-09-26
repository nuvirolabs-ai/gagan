import { describe, expect, it } from "vitest";
import { toggleBeatRetailer } from "../beatDraft";

describe("own beat selection", () => {
  it("keeps selected stores in visit order and removes an unselected store", () => {
    expect(toggleBeatRetailer(["store-2"], "store-1")).toEqual(["store-2", "store-1"]);
    expect(toggleBeatRetailer(["store-2", "store-1"], "store-2")).toEqual(["store-1"]);
  });
});
