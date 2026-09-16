import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../api";
import MarketSurveys from "../pages/MarketSurveys";

vi.mock("../api", () => ({
  api: {
    surveys: vi.fn().mockResolvedValue({ surveys: [] }),
    retailers: vi.fn().mockResolvedValue({ retailers: [{ id: "retailer-1", name: "Controlled retailer", phone: "retailer" }] }),
    staff: vi.fn().mockResolvedValue({ staff: [{ id: "staff-1", name: "Controlled salesperson", phone: "salesperson", salesRepId: "rep-1" }] }),
    createSurvey: vi.fn().mockResolvedValue({ survey: { id: "survey-1" } }),
    survey: vi.fn().mockResolvedValue({ survey: { id: "survey-1", title: "UAT", status: "draft", audience: "selected_retailers", questions: [], assignments: [] } }),
    surveyResponses: vi.fn().mockResolvedValue({ responses: [] }),
    surveySummary: vi.fn().mockResolvedValue({ summary: null }),
  },
}));

vi.mock("../errorCopy", () => ({ explain: (_error: unknown, fallback: string) => fallback }));

describe("Market Survey builder", () => {
  it("keeps newly added choice options in the draft", async () => {
    render(<MarketSurveys />);

    fireEvent.click(screen.getByRole("button", { name: "New survey" }));
    const typeSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(typeSelect, { target: { value: "single_choice" } });
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));

    await waitFor(() => expect(screen.getByPlaceholderText("Option 1")).toBeInTheDocument());
  });

  it("preserves selected retailer and salesperson assignments for one survey", async () => {
    render(<MarketSurveys />);

    fireEvent.click(screen.getByRole("button", { name: "New survey" }));
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "selected_retailers" } });
    await waitFor(() => expect(screen.getByText("Controlled retailer")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Controlled retailer/));
    fireEvent.click(screen.getByLabelText(/Controlled salesperson/));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(vi.mocked(api.createSurvey)).toHaveBeenCalledWith(expect.objectContaining({
      audience: "selected_retailers",
      retailerIds: ["retailer-1"],
      salespersonIds: ["staff-1"],
    })));
  });
});
