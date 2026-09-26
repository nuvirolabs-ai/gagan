import { describe, expect, it, vi } from "vitest";
import { createRetailerApi } from "../retailerApi";

describe("retailer salesperson feedback API", () => {
  it("sends the displayed SalesRep identity and supports exact-key and cursor reads", async () => {
    const request = vi.fn().mockResolvedValue({ feedback: [] });
    const api = createRetailerApi(request, {} as any);
    await api.salespersonFeedback();
    await api.salespersonFeedback("next-page");
    await api.salespersonFeedbackByReference("retry-a");
    await api.submitSalespersonFeedback("Helpful visit", "retry-a", "rep-a");
    expect(request).toHaveBeenNthCalledWith(1, "/salesperson-feedback");
    expect(request).toHaveBeenNthCalledWith(2, "/salesperson-feedback?cursor=next-page");
    expect(request).toHaveBeenNthCalledWith(3, "/salesperson-feedback/submissions/retry-a");
    expect(request).toHaveBeenNthCalledWith(4, "/salesperson-feedback", {
      method: "POST", body: JSON.stringify({ description: "Helpful visit", clientReference: "retry-a", expectedSalesRepId: "rep-a" }),
    }, true);
  });
});
