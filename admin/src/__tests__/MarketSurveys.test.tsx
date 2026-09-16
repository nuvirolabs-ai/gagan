import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketSurveys from "../pages/MarketSurveys";

vi.mock("../api", () => ({
  api: {
    surveys: vi.fn().mockResolvedValue({ surveys: [] }),
    retailers: vi.fn().mockResolvedValue({ retailers: [] }),
    staff: vi.fn().mockResolvedValue({ staff: [] }),
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
});
