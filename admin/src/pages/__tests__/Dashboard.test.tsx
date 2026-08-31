import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Dashboard from "../Dashboard";

describe("leader dashboard", () => {
  it("opens on the company health view with seeded metrics and top ten orders", () => {
    render(<Dashboard />);

    expect(screen.getByText("Good morning, Ananya")).toBeInTheDocument();
    expect(screen.getAllByText("₹ 8,42,650").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#GG-10482").length).toBeGreaterThan(0);
    expect(screen.getByText("#GG-10387")).toBeInTheDocument();
    expect(screen.getByText("Top 5 people making today happen")).toBeInTheDocument();
  });

  it("recalculates the range and order intelligence lenses", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getAllByText("₹ 1,68,42,110").length).toBeGreaterThan(0);
    expect(screen.getByText("5,192")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "By line items" }));
    expect(screen.getByText(/Haven House/)).toBeInTheDocument();
  });

  it("keeps warehouse and product data read-only while allowing inspection", () => {
    render(<Dashboard />);

    expect(screen.queryByRole("button", { name: /Add warehouse/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Bhiwandi Hub/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Delhi North/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("⌕ Search products"), { target: { value: "CloudRest" } });
    expect(screen.getByText("CloudRest Memory Pillow")).toBeInTheDocument();
    expect(screen.queryByText("AeroFlex Running Shoes")).not.toBeInTheDocument();
  });
});
