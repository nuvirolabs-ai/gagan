import { describe, expect, it, vi } from "vitest";
import { createStaffApi } from "../staffApi";

describe("own beat API", () => {
  it("lists, creates and edits through rep-scoped endpoints", async () => {
    const request = vi.fn().mockResolvedValue({ templates: [] });
    const api = createStaffApi(request, { load: vi.fn(), save: vi.fn(), clear: vi.fn() } as any);
    const body = { name: "North", stops: [{ retailerId: "store-1" }] };
    await api.beatTemplates();
    await api.saveBeatTemplate(body);
    await api.updateBeatTemplate("beat-1", body);
    expect(request.mock.calls.map(([path, options]) => [path, options?.method ?? "GET"])).toEqual([
      ["/rep/field/beat-templates", "GET"],
      ["/rep/field/beat-templates", "POST"],
      ["/rep/field/beat-templates/beat-1", "PUT"],
    ]);
  });

  it("omits a stored null note when sending an edited beat", async () => {
    const request = vi.fn().mockResolvedValue({ template: {} });
    const api = createStaffApi(request, { load: vi.fn(), save: vi.fn(), clear: vi.fn() } as any);
    await api.updateBeatTemplate("beat-1", {
      name: "North reviewed",
      stops: [{ retailerId: "store-1", purpose: "sales_call", note: null }],
    } as any);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      name: "North reviewed",
      stops: [{ retailerId: "store-1", purpose: "sales_call" }],
    });
  });
});
