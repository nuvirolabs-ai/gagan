import { api } from "../api";

export async function openExpenseReceipt(
  salespersonId: string,
  expenseId: string,
  stillCurrent: () => boolean = () => true
) {
  const popup = window.open("about:blank", "_blank");
  if (!popup) throw new Error("Could not open receipt tab. Allow pop-ups and try again.");
  popup.opener = null;
  try {
    const result: { receiptUrl: string } = await api.expenseReceipt(salespersonId, expenseId);
    if (stillCurrent()) popup.location.href = result.receiptUrl;
    else popup.close();
  } catch (error) {
    popup.close();
    const code = (error as { body?: { error?: string } } | null)?.body?.error;
    if (code === "expense_receipt_not_found") throw new Error("This claim's receipt is no longer available.");
    if (code === "expense_receipt_unavailable") throw new Error("Receipt is temporarily unavailable. Try again.");
    throw error;
  }
}
