import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Retailers from "../Retailers";

const mocks = vi.hoisted(() => ({ retailers: vi.fn(), tiers: vi.fn(), setInternalSegment: vi.fn() }));
vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return { ...actual, api: { ...actual.api, ...mocks } };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retailers.mockResolvedValue({ retailers: [{
    id: "retailer-1",
    name: "North Star Retail",
    phone: "9876543210",
    deliveryCity: "Pune",
    internalSegment: null,
    tier: { id: "tier-1", name: "Gold" },
    creditLimit: 10000,
    currentBalance: 2000,
    overdueAmount: 0,
    available: 8000,
  }] });
  mocks.tiers.mockResolvedValue({ tiers: [{ id: "tier-1", name: "Gold" }] });
  mocks.setInternalSegment.mockResolvedValue({ retailer: { id: "retailer-1", internalSegment: "A" } });
});

describe("retailer internal segment administration", () => {
  it("updates the internal segment without changing the pricing tier control", async () => {
    render(
      <MemoryRouter>
        <Retailers />
      </MemoryRouter>
    );

    expect(await screen.findByText("North Star Retail")).toBeInTheDocument();
    const segment = screen.getByLabelText("Internal segment for North Star Retail");
    expect(segment).toHaveValue("");
    fireEvent.change(segment, { target: { value: "A" } });

    await waitFor(() => expect(mocks.setInternalSegment).toHaveBeenCalledWith("retailer-1", "A"));
    expect(screen.getByLabelText("Commercial pricing tier for North Star Retail")).toHaveValue("tier-1");
  });
});
