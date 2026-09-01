import { describe, expect, it } from "vitest";
import {
  ancestorIds,
  buildTree,
  flattenTree,
  validateManagerAssignment,
  MAX_HIERARCHY_DEPTH,
} from "../hierarchyDomain";

const active = (id: string) => ({ id, status: "active" });

/** national → regional → area → salesperson, the shape the brief describes. */
function fourLevels() {
  return new Map<string, string | null>([
    ["national", null],
    ["regional", "national"],
    ["area", "regional"],
    ["sales", "area"],
  ]);
}

describe("walking up the tree", () => {
  it("returns the chain nearest-manager-first", () => {
    expect(ancestorIds("sales", fourLevels())).toEqual(["area", "regional", "national"]);
  });

  it("is empty at the top of the tree", () => {
    expect(ancestorIds("national", fourLevels())).toEqual([]);
  });

  it("terminates on a cycle written directly to the database", () => {
    // Not reachable through the API, but a restore or a manual UPDATE can do it,
    // and a manager's dashboard must degrade rather than hang.
    const corrupt = new Map<string, string | null>([
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ]);
    expect(ancestorIds("a", corrupt)).toEqual(["b", "c"]);
  });

  it("stops at the depth ceiling", () => {
    const deep = new Map<string, string | null>();
    for (let level = 0; level < 100; level += 1) {
      deep.set(`level-${level}`, level === 99 ? null : `level-${level + 1}`);
    }
    expect(ancestorIds("level-0", deep)).toHaveLength(MAX_HIERARCHY_DEPTH);
  });
});

describe("validating a manager assignment", () => {
  const managerOf = fourLevels();

  it("accepts an ordinary assignment", () => {
    expect(
      validateManagerAssignment({
        employeeId: "sales",
        proposedManagerId: "regional",
        employee: active("sales"),
        manager: active("regional"),
        managerOf,
      })
    ).toBeNull();
  });

  it("accepts moving someone to the top of the tree", () => {
    expect(
      validateManagerAssignment({
        employeeId: "area",
        proposedManagerId: null,
        employee: active("area"),
        managerOf,
      })
    ).toBeNull();
  });

  it("rejects self-management", () => {
    expect(
      validateManagerAssignment({
        employeeId: "area",
        proposedManagerId: "area",
        employee: active("area"),
        manager: active("area"),
        managerOf,
      })
    ).toBe("self_management");
  });

  it("rejects a direct cycle", () => {
    // regional already reports to national; national cannot report to regional.
    expect(
      validateManagerAssignment({
        employeeId: "national",
        proposedManagerId: "regional",
        employee: active("national"),
        manager: active("regional"),
        managerOf,
      })
    ).toBe("cycle");
  });

  it("rejects a cycle several levels away", () => {
    expect(
      validateManagerAssignment({
        employeeId: "national",
        proposedManagerId: "sales",
        employee: active("national"),
        manager: active("sales"),
        managerOf,
      })
    ).toBe("cycle");
  });

  it("rejects an inactive manager", () => {
    expect(
      validateManagerAssignment({
        employeeId: "sales",
        proposedManagerId: "regional",
        employee: active("sales"),
        manager: { id: "regional", status: "suspended" },
        managerOf,
      })
    ).toBe("manager_inactive");
  });

  it("rejects a manager who does not exist", () => {
    expect(
      validateManagerAssignment({
        employeeId: "sales",
        proposedManagerId: "ghost",
        employee: active("sales"),
        manager: undefined,
        managerOf,
      })
    ).toBe("manager_not_found");
  });

  it("rejects an employee who does not exist", () => {
    expect(
      validateManagerAssignment({
        employeeId: "ghost",
        proposedManagerId: "area",
        employee: undefined,
        manager: active("area"),
        managerOf,
      })
    ).toBe("employee_not_found");
  });

  it("refuses to reassign an inactive employee, keeping their line intact", () => {
    expect(
      validateManagerAssignment({
        employeeId: "sales",
        proposedManagerId: "regional",
        employee: { id: "sales", status: "revoked" },
        manager: active("regional"),
        managerOf,
      })
    ).toBe("employee_inactive");
  });

  it("refuses to make the chain deeper than the ceiling", () => {
    const deep = new Map<string, string | null>();
    for (let level = 0; level < MAX_HIERARCHY_DEPTH; level += 1) {
      deep.set(`level-${level}`, level === 0 ? null : `level-${level - 1}`);
    }
    const deepest = `level-${MAX_HIERARCHY_DEPTH - 1}`;
    expect(
      validateManagerAssignment({
        employeeId: "newcomer",
        proposedManagerId: deepest,
        employee: active("newcomer"),
        manager: active(deepest),
        managerOf: deep,
      })
    ).toBe("max_depth_exceeded");
  });

  it("does not care what anybody is called", () => {
    // No job title appears in the rules: a "salesperson" may manage a
    // "national head" as far as the structure is concerned, because titles are
    // labels and reporting is structural.
    const flat = new Map<string, string | null>([["head", null], ["junior", null]]);
    expect(
      validateManagerAssignment({
        employeeId: "head",
        proposedManagerId: "junior",
        employee: active("head"),
        manager: active("junior"),
        managerOf: flat,
      })
    ).toBeNull();
  });
});

describe("shaping a tree", () => {
  const nodes = [
    { id: "national", name: "Nita", managerId: null },
    { id: "regional-w", name: "West", managerId: "national" },
    { id: "regional-e", name: "East", managerId: "national" },
    { id: "area-1", name: "Area One", managerId: "regional-e" },
    { id: "orphan", name: "Unassigned", managerId: null },
  ];

  it("nests children under their manager and records depth", () => {
    const roots = buildTree(nodes);
    const flat = flattenTree(roots);
    const byId = new Map(flat.map((node) => [node.id, node]));
    expect(byId.get("national")!.depth).toBe(0);
    expect(byId.get("regional-e")!.depth).toBe(1);
    expect(byId.get("area-1")!.depth).toBe(2);
    expect(byId.get("national")!.reportCount).toBe(2);
  });

  it("puts everyone with no manager at the top", () => {
    const roots = buildTree(nodes);
    expect(roots.map((root) => root.id).sort()).toEqual(["national", "orphan"]);
  });

  it("renders depth-first so an indented list reads in order", () => {
    const flat = flattenTree(buildTree(nodes));
    expect(flat.map((node) => node.id)).toEqual([
      "national",
      "regional-e",
      "area-1",
      "regional-w",
      "orphan",
    ]);
  });

  it("does not hang or silently re-parent when the data contains a cycle", () => {
    const cyclic = [
      { id: "a", name: "A", managerId: "b" },
      { id: "b", name: "B", managerId: "a" },
      { id: "c", name: "C", managerId: null },
    ];
    const flat = flattenTree(buildTree(cyclic));
    expect(flat.map((node) => node.id)).toContain("c");
    // The cycle produces no infinite nesting; each node appears at most once.
    expect(new Set(flat.map((node) => node.id)).size).toBe(flat.length);
  });
});
