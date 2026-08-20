import { describe, expect, it } from "vitest";
import { addDays, ageingFor } from "../lib/ageing";

describe("addDays", () => {
  it("does not mutate the invoice date", () => {
    const invoiceDate = new Date("2026-08-01T00:00:00.000Z");

    const dueDate = addDays(invoiceDate, 15);

    expect(dueDate.toISOString()).toBe("2026-08-16T00:00:00.000Z");
    expect(invoiceDate.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("ageingFor", () => {
  it("places open invoice value into the existing due-date buckets", async () => {
    const db = {
      ledgerEntry: {
        findMany: async () => [
          { amount: 1_000, settledAmount: 250, dueDate: new Date("2026-07-01T00:00:00.000Z") },
          { amount: 500, settledAmount: 0, dueDate: new Date("2026-09-01T00:00:00.000Z") },
        ],
      },
    };

    const result = await ageingFor(
      db as unknown as Parameters<typeof ageingFor>[0],
      "retailer-1",
      new Date("2026-08-20T00:00:00.000Z")
    );

    expect(result.days31to60).toBe(750);
    expect(result.current).toBe(500);
    expect(result.totalOutstanding).toBe(1_250);
    expect(result.totalOverdue).toBe(750);
  });
});
