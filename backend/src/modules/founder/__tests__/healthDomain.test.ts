import { describe, expect, it } from "vitest";
import {
  collectionsHealth,
  fulfilmentHealth,
  inventoryHealth,
  receivablesHealth,
  salesHealth,
  salesTeamHealth,
  systemsHealth,
} from "../healthDomain";
import { FOUNDER_HEALTH_RULES } from "../healthRules";

describe("health thresholds", () => {
  it("uses the shared rules object rather than ad hoc percentages", () => {
    expect(FOUNDER_HEALTH_RULES.sales.healthyMin).toBe(0.95);
    expect(salesHealth(95, 100, "t").status).toBe("HEALTHY");
    expect(salesHealth(90, 100, "t").status).toBe("WATCH");
    expect(salesHealth(70, 100, "t").status).toBe("AT_RISK");
    expect(collectionsHealth(70, 100, "t").status).toBe("AT_RISK");
  });

  it("does not treat unavailable fill rate as zero", () => {
    const domain = fulfilmentHealth(null, "t");
    expect(domain.status).toBe("WATCH");
    expect(domain.reason).toMatch(/Not enough canonical data/);
    expect(fulfilmentHealth(96, "t").status).toBe("HEALTHY");
    expect(fulfilmentHealth(91, "t").status).toBe("WATCH");
    expect(fulfilmentHealth(80, "t").status).toBe("AT_RISK");
  });

  it("judges inventory and receivables as shares, not raw zeros", () => {
    expect(inventoryHealth(0, 0, "t").status).toBe("HEALTHY");
    expect(inventoryHealth(1_200, 10_000, "t").status).toBe("AT_RISK");
    expect(receivablesHealth(null, null, "t").status).toBe("WATCH");
    expect(receivablesHealth(100, 50, "t").status).toBe("AT_RISK");
  });

  it("uses workday calendar and outbox failures for team and systems", () => {
    expect(salesTeamHealth(0, 4, false, "t").status).toBe("HEALTHY");
    expect(salesTeamHealth(2, 4, true, "t").status).toBe("AT_RISK");
    expect(systemsHealth(0, "t").status).toBe("HEALTHY");
    expect(systemsHealth(0, "t").reason).toMatch(/No critical system issues/);
    expect(systemsHealth(5, "t").status).toBe("AT_RISK");
  });
});
