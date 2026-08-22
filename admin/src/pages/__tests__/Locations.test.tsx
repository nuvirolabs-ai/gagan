import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Locations from "../Locations";

vi.mock("../../api", () => ({ api: { locations: vi.fn().mockResolvedValue({ locations: [{ id: "l1", retailerId: "r1", retailer: { name: "Mahesh Store", shopAddress: "Market Road" }, status: "VERIFIED", locationVersion: 2, latitude: 18.5, longitude: 73.8, accuracyMeters: 12, updatedAt: "2026-08-21T00:00:00.000Z" }] }), locationHistory: vi.fn().mockResolvedValue({ history: [] }) } }));

describe("Locations", () => {
  it("shows the verified store status", async () => {
    render(<Locations />);
    expect(await screen.findByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Mahesh Store")).toBeInTheDocument();
  });
});
