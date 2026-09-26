import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportCenter from "../ImportCenter";
import { api } from "../../api";

vi.mock("../../api", () => ({ api: {
  importTypes: vi.fn(async () => ({ types: [{ type: "retailers", label: "Retailers", description: "Retailer master data", required: ["name", "phone"], optional: [], modes: ["upsert"] }] })),
  imports: vi.fn(async () => ({ imports: [] })),
  importPreview: vi.fn(async () => ({ job: { id: "job-1" }, summary: { totalRows: 1, validRows: 1, warningRows: 0, failedRows: 0 }, rows: [{ rowNumber: 2, values: {}, errors: [], warnings: [], action: "create" }] })),
  applyImport: vi.fn(async () => ({ totalRows: 1, createdRows: 1, updatedRows: 0, failedRows: 0, warningRows: 0 })),
  importTemplate: vi.fn(),
  importErrors: vi.fn(),
} }));

describe("Import Center", () => {
  it("keeps the explicit preview then apply gate visible", async () => {
    render(<ImportCenter />);
    expect(await screen.findByText("Data Import")).toBeInTheDocument();
    const file = new File(["name,phone\nQA,9899999901\n"], "retailers.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview import →" }));
    expect(await screen.findByText("Ready for review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply 1 records →" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 records →" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply import" }));
    await waitFor(() => expect(screen.getByText("Import complete")).toBeInTheDocument());
  });

  it("explains that product imports create drafts", async () => {
    vi.mocked(api.importTypes).mockResolvedValueOnce({ types: [{ type: "products", label: "Products / SKUs", description: "Products", required: ["product_name", "unit_size"], optional: ["product_id", "variant_id"], modes: ["create_only", "update_only", "upsert"] }] });
    render(<ImportCenter />);
    expect(await screen.findByText(/New products and packs stay pending review/)).toBeInTheDocument();
  });
});
