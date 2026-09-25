export { localDayKey, monthCells, monthLabel } from "../dateOnly";
import { parseDateOnly } from "../dateOnly";

/** Parse a day without allowing device timezone conversion to change it. */
export const parseExpenseDate = parseDateOnly;

export function expenseDatePayload(value: string): string {
  const parsed = parseExpenseDate(value);
  if (!parsed) throw new Error("invalid_expense_date");
  return parsed.toISOString();
}

export { formatDateOnly as displayExpenseDate } from "../dateOnly";
