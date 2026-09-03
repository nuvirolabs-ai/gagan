import { describe, expect, it } from "vitest";
import { mapSeriesBoard, mapTodayBoard } from "../mapPulse";
import { PULSE_FIXTURE } from "../../fixtures/pulse";

describe("Today board mapping", () => {
  const board = mapTodayBoard(PULSE_FIXTURE, "fixture");

  it("locks the chairman mock KPIs", () => {
    expect(board.title).toBe("Today");
    expect(board.viewerName).toBe("Ananya");
    expect(board.hub).toBe("Indore hub");
    expect(board.health.label).toBe("Amber");
    expect(board.health.detail).toContain("38/42 on floor");
    expect(board.salesHero.value).toBe("₹42.6L");
    expect(board.salesHero.week.label).toBe("Week +8.2%");
    expect(board.tiles[0].value).toBe("38/42");
    expect(board.tiles[1].value).toBe("87%");
    expect(board.tiles[1].week.label).toBe("W flat");
    expect(board.tiles[2].value).toBe("₹31.2L");
    expect(board.tiles[3].value).toBe("₹1.84Cr");
    expect(board.period.find((r) => r.id === "otif")?.month).toEqual({ text: "84%", tone: "down" });
    expect(board.needsYou).toHaveLength(2);
    expect(board.readout).toMatch(/watch OTIF month drift/);
  });

  it("keeps a filled 14-day sales area on Today", () => {
    expect(board.salesHero.series.points).toHaveLength(14);
    expect(board.salesHero.series.color).toBe("#3DDC97");
    expect(board.tiles.every((t) => t.spark.kind === "area")).toBe(true);
  });
});

describe("Series A+C mapping", () => {
  it("defaults week to Bloomberg columns + ghost prior + heat", () => {
    const board = mapSeriesBoard(PULSE_FIXTURE, "week", "fixture");
    expect(board.salesHero.value).toBe("₹18.4L");
    expect(board.salesHero.growth.label).toBe("+8.2%");
    expect(board.salesHero.columns).toHaveLength(7);
    expect(board.salesHero.heat).toHaveLength(7);
    expect(board.tiles[0].spark.kind).toBe("heat");
    expect(board.tiles[1].spark.kind).toBe("bars");
    expect(board.tiles[2].spark.kind).toBe("columns");
    expect(board.tiles[3].spark.kind).toBe("bars");
    expect(board.vsPrior).toHaveLength(5);
    expect(board.readout).toMatch(/OTIF soft vs prior/);
  });

  it("switches Day and Month without dropping the five KPIs", () => {
    const day = mapSeriesBoard(PULSE_FIXTURE, "day", "fixture");
    const month = mapSeriesBoard(PULSE_FIXTURE, "month", "fixture");
    expect(day.salesHero.columns.length).toBeGreaterThan(3);
    expect(month.salesHero.value).toBe("₹78.2L");
    expect(month.tiles).toHaveLength(4);
  });
});
