import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Visits from "../Visits";

vi.mock("../../api", () => ({ api: { visits: vi.fn().mockResolvedValue({ visits: [{ id: "v1", salespersonId: "s1", salesperson: { name: "Ravi Kumar" }, retailerId: "r1", retailer: { name: "Mahesh Store" }, checkedInAt: "2026-08-21T05:34:00.000Z", checkedOutAt: null, distanceFromStoreMeters: 37, verificationStatus: "VERIFIED" }] }) } }));

describe("Visits", () => {
  it("renders neutral verified visit information", async () => {
    render(<Visits />);
    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("37 m")).toBeInTheDocument();
  });
});
