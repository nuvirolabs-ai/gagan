import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ServiceIssues from "../ServiceIssues";

const { updateServiceIssue } = vi.hoisted(() => ({
  updateServiceIssue: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api", () => ({
  api: {
    serviceIssues: vi.fn().mockResolvedValue({
      issues: [
        {
          id: "issue-1",
          retailer: { name: "Mahesh Store" },
          raisedBy: { name: "Ravi Kumar" },
          type: "damaged_product",
          priority: "high",
          description: "Two cases crushed on delivery",
          status: "open",
        },
      ],
    }),
    updateServiceIssue,
  },
}));

describe("Service issues", () => {
  it("lists an issue with who raised it", async () => {
    render(<ServiceIssues />);
    expect(await screen.findByText("Mahesh Store")).toBeInTheDocument();
    expect(screen.getByText("damaged product")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
  });

  it("refuses to close an issue without a resolution note", async () => {
    render(<ServiceIssues />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    expect(updateServiceIssue).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Add a resolution note before closing an issue.")
    ).toBeInTheDocument();
  });

  it("closes an issue once a resolution note is given", async () => {
    render(<ServiceIssues />);
    fireEvent.change(await screen.findByPlaceholderText(/Replacement cartons/), { target: { value: "Replacement dispatched" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(updateServiceIssue).toHaveBeenCalledWith("issue-1", {
        status: "resolved",
        assignedTeam: undefined,
        resolutionNote: "Replacement dispatched",
      })
    );
  });
});
