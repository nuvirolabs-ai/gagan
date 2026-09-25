import { staffCapabilities } from "../auth/staffCapabilities";

export const MARKET_SURVEY_ROUTE = "MarketSurveys" as const;
export const MARKET_SURVEY_LABEL = "Market Surveys" as const;

export type MoreNavigationItem = {
  icon: string;
  label: string;
  subtitle: string;
  screen: string;
};

export function canOpenMarketSurveys(permissions: readonly string[]) {
  return staffCapabilities([...permissions]).canRespondToSurveys;
}

export function marketSurveysEntry(permissions: readonly string[]): MoreNavigationItem | null {
  return canOpenMarketSurveys(permissions)
    ? {
        icon: "clipboard-outline",
        label: MARKET_SURVEY_LABEL,
        subtitle: "Answer your manager's active questions",
        screen: MARKET_SURVEY_ROUTE,
      }
    : null;
}
