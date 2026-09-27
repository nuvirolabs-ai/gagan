import { describe, expect, it } from "vitest";
import { ownBeatRetailerIds } from "./ownBeatOutlets";

const beats = [
  { id: "north", name: "North", stops: [{ retailerId: "one", sequence: 1 }, { retailerId: "two", sequence: 2 }] },
  { id: "south", name: "South", stops: [{ retailerId: "two", sequence: 1 }, { retailerId: "three", sequence: 2 }] },
];

describe("own beat outlet filter", () => {
  it("shows the union of saved self-beat stores", () => {
    expect([...ownBeatRetailerIds(beats, "")]).toEqual(["one", "two", "three"]);
  });

  it("narrows to a selected beat", () => {
    expect([...ownBeatRetailerIds(beats, "south")]).toEqual(["two", "three"]);
  });
});
