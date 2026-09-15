import { describe, expect, it } from "vitest";
import { SurveyQuestionType } from "@prisma/client";
import { SurveyError, SurveyService } from "../surveyService";

const survey = {
  questions: [
    { id: "choice", type: SurveyQuestionType.single_choice, required: true, options: [{ id: "fast", label: "Fast" }, { id: "slow", label: "Slow" }] },
    { id: "multi", type: SurveyQuestionType.multiple_choice, required: false, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
    { id: "yes", type: SurveyQuestionType.yes_no, required: true, options: [] },
    { id: "rating", type: SurveyQuestionType.rating, required: true, minValue: 1, maxValue: 5, options: [] },
    { id: "number", type: SurveyQuestionType.number, required: false, minValue: 0, maxValue: 100, options: [] },
    { id: "text", type: SurveyQuestionType.text, required: false, maxLength: 12, options: [] },
  ],
} as any;

const service = new SurveyService({} as any);

describe("market survey answer contract", () => {
  it("normalizes every V1 answer type and preserves option identity", () => {
    const result = service.normalizeAnswers(survey, [
      { questionId: "choice", optionIds: ["fast"] },
      { questionId: "multi", optionIds: ["b", "a"] },
      { questionId: "yes", value: "YES" },
      { questionId: "rating", value: 4 },
      { questionId: "number", value: "12.5" },
      { questionId: "text", value: "Good stock" },
    ]);
    expect(result).toEqual([
      { questionId: "choice", optionIds: ["fast"], value: null },
      { questionId: "multi", optionIds: ["b", "a"], value: null },
      { questionId: "yes", optionIds: [], value: true },
      { questionId: "rating", optionIds: [], value: 4 },
      { questionId: "number", optionIds: [], value: 12.5 },
      { questionId: "text", optionIds: [], value: "Good stock" },
    ]);
  });

  it("rejects missing required answers and unknown options", () => {
    expect(() => service.normalizeAnswers(survey, [])).toThrowError(SurveyError);
    expect(() => service.normalizeAnswers(survey, [
      { questionId: "choice", optionIds: ["not-from-question"] },
      { questionId: "yes", value: true },
      { questionId: "rating", value: 5 },
    ])).toThrow("option_not_in_question");
  });

  it("enforces type-specific cardinality and numeric/text bounds", () => {
    expect(() => service.normalizeAnswers(survey, [
      { questionId: "choice", optionIds: ["fast", "slow"] },
      { questionId: "yes", value: false },
      { questionId: "rating", value: 3 },
    ])).toThrow("single_choice_multiple_options");
    expect(() => service.normalizeAnswers(survey, [
      { questionId: "choice", optionIds: ["fast"] },
      { questionId: "yes", value: false },
      { questionId: "rating", value: 6 },
    ])).toThrow("number_answer_out_of_range");
    expect(() => service.normalizeAnswers(survey, [
      { questionId: "choice", optionIds: ["fast"] },
      { questionId: "yes", value: false },
      { questionId: "rating", value: 3 },
      { questionId: "text", value: "This answer is too long" },
    ])).toThrow("text_answer_invalid");
  });
});
