import { Children, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  RefreshControl: "RefreshControl",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));
vi.mock("../../components/ui", () => ({
  AppScreen: "AppScreen",
  EmptyState: "EmptyState",
  ErrorState: "ErrorState",
  MetricStrip: "MetricStrip",
  ProgressRow: "ProgressRow",
  SectionHeader: "SectionHeader",
  StatusChip: "StatusChip",
  Surface: "Surface",
}));
vi.mock("../../api/repClient", () => ({ repApi: { salesLeader: () => Promise.resolve(null) } }));
vi.mock("../../i18n/LanguageContext", () => ({ useLanguage: () => ({ t: () => "" }) }));

import { TeamMember } from "../TeamPerformanceScreen";
import { selectTeamPerformancePresentation } from "../teamPerformancePresentation";
import { translate, type TranslationKey } from "../../i18n/translations";

describe("Team Performance member heading", () => {
  it.each(["en", "hi"] as const)("keeps the full rank metric on its own wrapping line in %s", (language) => {
    const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars);
    const member = { salespersonId: "ravi", name: "Ravi Kumar", territory: "Pune North", rank: 1, attendance: "absent" };
    const presentation = selectTeamPerformancePresentation({
      leaderboard: { metric: "target_achievement_pct" },
      members: [member],
    }, t).members[0];
    const card = TeamMember({ member, presentation, t }) as ReactElement<any>;
    const heading = Children.toArray(card.props.children)[0] as ReactElement<any>;
    const identity = Children.toArray(heading.props.children)[0] as ReactElement<any>;
    const lines = Children.toArray(identity.props.children) as ReactElement<any>[];

    expect(lines[1].props.children).toBe("Pune North");
    expect(lines[2].props.children).toBe(presentation.rankLabel);
    expect(lines[2].props.numberOfLines).toBeUndefined();
  });

  it("constrains a long member actual and target beside the percentage", () => {
    const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate("en", key, vars);
    const member = {
      salespersonId: "ravi",
      name: "Ravi Kumar",
      attendance: "absent",
      actuals: { order_value: 452651 },
      headlineTarget: { metric: "order_value", actual: 452651, target: 400000, completionPct: 113 },
    };
    const presentation = selectTeamPerformancePresentation({ members: [member] }, t).members[0];
    const card = TeamMember({ member, presentation, t }) as ReactElement<any>;
    const target = Children.toArray(card.props.children)[1] as ReactElement<any>;
    const row = Children.toArray(target.props.children)[0] as ReactElement<any>;
    const [amount, completion] = Children.toArray(row.props.children) as ReactElement<any>[];
    const style = Array.isArray(amount.props.style)
      ? Object.assign({}, ...amount.props.style)
      : amount.props.style;
    const completionStyle = Array.isArray(completion.props.style)
      ? Object.assign({}, ...completion.props.style)
      : completion.props.style;

    expect(style).toMatchObject({ flex: 1, minWidth: 0 });
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(JSON.stringify(amount.props.children)).toContain("₹4,00,000");
    expect(completionStyle).toMatchObject({ marginRight: 8 });
  });
});
