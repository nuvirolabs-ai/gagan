import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ServiceIssues from "../ServiceIssues";
import { api } from "../../api";

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
    exportServiceIssues: vi.fn().mockResolvedValue(new Blob(["xlsx"])),
  },
}));

describe("Service issues", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
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

  it("keeps withdrawn retailer requests visible without offering another transition", async () => {
    vi.mocked(api.serviceIssues).mockResolvedValueOnce({ issues: [] } as any).mockResolvedValueOnce({ issues: [{
      id: "request-1", retailer: { name: "Mahesh Store" }, raisedBy: null, raisedByStaffId: null,
      type: "service_request", priority: "normal", description: "Delivery question", status: "withdrawn",
    }] } as any);
    render(<ServiceIssues />);
    fireEvent.click(await screen.findByRole("button", { name: "Withdrawn" }));
    expect(await screen.findByText("Delivery question")).toBeInTheDocument();
    expect(screen.getByText("Retailer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("exports the applied status and retailer filters rather than an unfiltered issue set", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:issues") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const downloadLinks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadLinks.push(this);
    });
    render(<ServiceIssues />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolved" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Retailer ID filter" }), { target: { value: "retailer-a" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply retailer filter" }));
    fireEvent.change(screen.getByLabelText("Export from (UTC)"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Export through (UTC)"), { target: { value: "2026-09-20" } });
    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Export Excel" })));
    expect(api.exportServiceIssues).toHaveBeenCalledWith({
      status: "resolved", retailerId: "retailer-a", from: "2026-09-01", through: "2026-09-20",
    });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(await blob.text()).toBe("xlsx");
    expect(downloadLinks[0]?.download).toBe("gagan-service-issues.xlsx");
    expect(downloadLinks[0]?.isConnected).toBe(true);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:issues");
    expect(downloadLinks[0]?.isConnected).toBe(false);
  });

  it("stops an inverted date range before requesting a workbook", async () => {
    render(<ServiceIssues />);
    fireEvent.change(screen.getByLabelText("Export from (UTC)"), { target: { value: "2026-09-21" } });
    fireEvent.change(screen.getByLabelText("Export through (UTC)"), { target: { value: "2026-09-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    expect(await screen.findByText(/through date must be on or after/i)).toBeInTheDocument();
    expect(api.exportServiceIssues).not.toHaveBeenCalled();
  });

  it("explains when an export is too large rather than showing a raw code", async () => {
    vi.mocked(api.exportServiceIssues).mockRejectedValueOnce({ body: { error: "export_too_large" } });
    render(<ServiceIssues />);
    fireEvent.click(await screen.findByRole("button", { name: "Export Excel" }));
    expect(await screen.findByText(/more than 5,000 matching issues/i)).toBeInTheDocument();
  });
});
