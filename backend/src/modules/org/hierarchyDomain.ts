/**
 * Reporting-hierarchy rules, with no database in sight.
 *
 * The hierarchy is one nullable edge on StaffUser (`managerId`). Everything a
 * reader needs — a team, a chain, a tree — is derived from that edge, so the
 * rules that keep the edge sane live here where they can be tested exhaustively
 * without a Postgres round trip.
 *
 * Deliberately absent: job titles. "National Sales Head" and "Area Manager" are
 * labels an organisation chooses; depth and reporting are structural. Nothing in
 * this file, or anything that calls it, branches on a role name.
 */

/** How deep a reporting tree may go before we treat the data as corrupt. */
export const MAX_HIERARCHY_DEPTH = 20;

export interface HierarchyNode {
  id: string;
  name: string;
  managerId: string | null;
  status?: string;
}

export type ManagerAssignmentError =
  | "self_management"
  | "cycle"
  | "manager_not_found"
  | "manager_inactive"
  | "employee_not_found"
  | "employee_inactive"
  | "max_depth_exceeded";

export interface AssignmentCandidate {
  id: string;
  status: string;
}

/**
 * Walk up from `startId` and return the chain of manager ids, nearest first.
 *
 * The `seen` set is not defensive clutter: a cycle written directly to the
 * database (a restore, a manual UPDATE) must degrade to a truncated chain, not
 * an infinite loop that pins a CPU on somebody's dashboard.
 */
export function ancestorIds(
  startId: string,
  managerOf: Map<string, string | null>,
  maxDepth = MAX_HIERARCHY_DEPTH
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([startId]);
  let current = managerOf.get(startId) ?? null;
  while (current && chain.length < maxDepth && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = managerOf.get(current) ?? null;
  }
  return chain;
}

/**
 * Why `proposedManagerId` may not manage `employeeId`, or null if it may.
 *
 * Order matters for the message the admin sees: self-management is a clearer
 * explanation than "cycle", even though a self-edge is also a cycle.
 */
export function validateManagerAssignment(input: {
  employeeId: string;
  proposedManagerId: string | null;
  employee?: AssignmentCandidate;
  manager?: AssignmentCandidate;
  managerOf: Map<string, string | null>;
  maxDepth?: number;
}): ManagerAssignmentError | null {
  const { employeeId, proposedManagerId, employee, manager, managerOf } = input;

  if (!employee) return "employee_not_found";
  // A suspended employee keeps their reporting line; it is reassigning them
  // that is blocked, so history stays intact while they are inactive.
  if (employee.status !== "active") return "employee_inactive";

  // Clearing the manager always succeeds: someone has to be at the top, and
  // detaching a subtree must never be blocked by the tree it is leaving.
  if (proposedManagerId === null) return null;

  if (proposedManagerId === employeeId) return "self_management";
  if (!manager) return "manager_not_found";
  if (manager.status !== "active") return "manager_inactive";

  // A cycle is exactly "the employee already sits above the proposed manager".
  const chain = ancestorIds(proposedManagerId, managerOf, input.maxDepth ?? MAX_HIERARCHY_DEPTH);
  if (chain.includes(employeeId)) return "cycle";

  // +2 = the new edge, plus the employee's own level.
  if (chain.length + 2 > (input.maxDepth ?? MAX_HIERARCHY_DEPTH)) return "max_depth_exceeded";

  return null;
}

export const ASSIGNMENT_ERROR_MESSAGES: Record<ManagerAssignmentError, string> = {
  self_management: "An employee cannot report to themselves.",
  cycle: "That manager already reports to this employee, directly or indirectly.",
  manager_not_found: "That manager does not exist.",
  manager_inactive: "That manager is not active.",
  employee_not_found: "That employee does not exist.",
  employee_inactive: "That employee is not active.",
  max_depth_exceeded: "That would make the reporting chain too deep.",
};

export interface TreeNode extends HierarchyNode {
  depth: number;
  children: TreeNode[];
}

/**
 * Shape a flat employee list into forests rooted at everyone with no manager
 * (or whose manager is outside the list, which is what a subtree read returns).
 *
 * Nodes reachable only through a cycle are dropped rather than silently
 * re-parented — the admin screen shows them in "unassigned" instead, where the
 * problem is visible and fixable.
 */
export function buildTree(nodes: HierarchyNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const node of nodes) byId.set(node.id, { ...node, depth: 0, children: [] });

  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.managerId ? byId.get(node.managerId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }

  const assignDepth = (node: TreeNode, depth: number, seen: Set<string>) => {
    node.depth = depth;
    node.children = node.children.filter((child) => !seen.has(child.id));
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of node.children) {
      assignDepth(child, depth + 1, new Set([...seen, child.id]));
    }
  };
  roots.sort((a, b) => a.name.localeCompare(b.name));
  for (const root of roots) assignDepth(root, 0, new Set([root.id]));

  return roots;
}

/** Depth-first flatten, so a tree renders as an indented list without recursion in the view. */
export function flattenTree(roots: TreeNode[]): Array<HierarchyNode & { depth: number; reportCount: number }> {
  const out: Array<HierarchyNode & { depth: number; reportCount: number }> = [];
  const walk = (node: TreeNode) => {
    out.push({
      id: node.id,
      name: node.name,
      managerId: node.managerId,
      status: node.status,
      depth: node.depth,
      reportCount: node.children.length,
    });
    for (const child of node.children) walk(child);
  };
  for (const root of roots) walk(root);
  return out;
}

/* --------------------------- rollout auditing ---------------------------- */

export interface AuditableStaff {
  id: string;
  name: string;
  status: string;
  managerId: string | null;
}

export interface ChainAudit {
  /** Levels above each employee, or -1 when their chain never reaches a root. */
  depth: Map<string, number>;
  /** Each distinct loop once, as names in walk order. */
  cycles: string[][];
  /** Employees whose managerId points at nobody. */
  invalidRefs: AuditableStaff[];
  /** Employees whose managerId is their own id. */
  selfManaged: AuditableStaff[];
}

/**
 * Walk every employee's chain upward and report what is structurally wrong.
 *
 * This is what a pre-deployment check needs and what `HierarchyService` cannot
 * give it: the service is built to *survive* bad data (its CTEs terminate on a
 * cycle rather than reporting it), whereas a rollout check has to name the
 * damage. Keeping it pure means the failure modes can be tested exhaustively
 * without writing a cycle into a real database to see what happens.
 */
export function auditChains(staff: AuditableStaff[], maxDepth = MAX_HIERARCHY_DEPTH): ChainAudit {
  const byId = new Map(staff.map((row) => [row.id, row]));
  const depth = new Map<string, number>();
  const cycles: string[][] = [];
  const invalidRefs: AuditableStaff[] = [];
  const selfManaged: AuditableStaff[] = [];
  const seenCycle = new Set<string>();

  for (const person of staff) {
    if (person.managerId === person.id) {
      selfManaged.push(person);
      depth.set(person.id, -1);
      continue;
    }

    const path: string[] = [person.id];
    const visited = new Set<string>([person.id]);
    let current = person.managerId;
    let broken = false;

    while (current) {
      if (visited.has(current)) {
        // Key on the sorted members so one loop reported from five different
        // employees prints once rather than five times.
        const start = path.indexOf(current);
        const loop = path.slice(start === -1 ? 0 : start);
        const key = [...loop].sort().join("|");
        if (!seenCycle.has(key)) {
          seenCycle.add(key);
          cycles.push(loop.map((id) => byId.get(id)?.name ?? id));
        }
        broken = true;
        break;
      }
      const manager = byId.get(current);
      if (!manager) {
        invalidRefs.push(person);
        broken = true;
        break;
      }
      path.push(current);
      visited.add(current);
      current = manager.managerId;
      if (path.length > maxDepth) {
        broken = true;
        break;
      }
    }

    depth.set(person.id, broken ? -1 : path.length - 1);
  }

  return { depth, cycles, invalidRefs, selfManaged };
}
