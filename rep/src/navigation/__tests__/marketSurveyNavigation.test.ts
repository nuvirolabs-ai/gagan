import { describe, expect, it } from "vitest";
import {
  canOpenMarketSurveys,
  MARKET_SURVEY_LABEL,
  MARKET_SURVEY_ROUTE,
  marketSurveysEntry,
} from "../marketSurveyNavigation";

describe("Salesperson Market Surveys navigation", () => {
  it("exposes a More entry only when the server-issued permission is present", () => {
    expect(marketSurveysEntry([])).toBeNull();
    expect(marketSurveysEntry(["survey.respond"])).toEqual({
      icon: "clipboard-outline",
      label: "Market Surveys",
      subtitle: "Answer your manager's active questions",
      screen: "MarketSurveys",
    });
  });

  it("keeps the row and stack route on the existing survey screen", () => {
    expect(canOpenMarketSurveys(["survey.respond"])).toBe(true);
    expect(MARKET_SURVEY_LABEL).toBe("Market Surveys");
    expect(MARKET_SURVEY_ROUTE).toBe("MarketSurveys");
    expect(marketSurveysEntry(["survey.respond"])?.screen).toBe(MARKET_SURVEY_ROUTE);
  });

  it("does not grant navigation from unrelated permissions", () => {
    expect(canOpenMarketSurveys(["route.execute", "order.create_for_retailer"])).toBe(false);
  });
});
