import type { StaffAuth } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { HierarchyService, hierarchyService } from "./hierarchyService";

/**
 * Reporting scope: the second half of every authorisation decision.
 *
 * Permission answers "may this person review expenses at all". Scope answers
 * "whose expenses". Both must pass. Holding `expense.review` never widens what
 * a manager can see, and sitting above someone in the tree never grants a
 * permission they were not given — the two compose, neither substitutes.
 *
 * The resolved scope is always derived on the server from the authenticated
 * staff id. A client-supplied employee id can narrow a request but can never
 * grant one; an id outside the caller's scope is rejected, not silently ignored.
 */
export type ScopeKind = "org" | "team" | "self";

export interface ReportingScope {
  kind: ScopeKind;
  /** The caller. */
  staffId: string;
  /**
   * The staff ids in scope, or null when the scope is the whole organisation
   * (null means "do not filter" — an empty array would mean "nobody").
   */
  staffIds: string[] | null;
}

export function isOrgWide(scope: ReportingScope): boolean {
  return scope.staffIds === null;
}

/** True when `staffId` is inside the scope. Org-wide scope contains everyone. */
export function scopeContains(scope: ReportingScope, staffId: string): boolean {
  return scope.staffIds === null || scope.staffIds.includes(staffId);
}

/**
 * Turn `staffIds` into a Prisma `where` fragment. Org-wide contributes nothing,
 * which is how one call site serves both a director and a first-line manager.
 */
export function scopeWhere(scope: ReportingScope, field = "salespersonId"): Record<string, unknown> {
  if (scope.staffIds === null) return {};
  return { [field]: { in: scope.staffIds } };
}

export class ScopeError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

export class ScopeResolver {
  constructor(private readonly hierarchy: HierarchyService = hierarchyService) {}

  /**
   * The caller's scope.
   *
   * `org.view_all` lifts the reporting restriction entirely — a director's
   * remit is the company, and forcing them into a tree would mean modelling
   * every employee under them just to let them read a report.
   *
   * Otherwise scope is the caller's own subtree, including themselves. A
   * manager with no reports therefore sees only their own rows, which is the
   * correct answer and not an error: they simply have no team yet.
   */
  async resolve(auth: StaffAuth): Promise<ReportingScope> {
    if (auth.permissions.includes(Permissions.ORG_VIEW_ALL)) {
      return { kind: "org", staffId: auth.staffId, staffIds: null };
    }
    const staffIds = await this.hierarchy.teamStaffIds(auth.staffId);
    return {
      kind: staffIds.length > 1 ? "team" : "self",
      staffId: auth.staffId,
      staffIds,
    };
  }

  /**
   * Resolve scope and narrow it to one requested employee.
   *
   * This is the single guard for "?salespersonId=" style parameters. Out of
   * scope is a 403 rather than an empty list, because an empty list reads as
   * "this person did nothing today" and quietly hides an authorisation bug.
   */
  async resolveFor(auth: StaffAuth, requestedStaffId?: string | null): Promise<ReportingScope> {
    const scope = await this.resolve(auth);
    if (!requestedStaffId) return scope;
    if (!scopeContains(scope, requestedStaffId)) {
      throw new ScopeError(403, "outside_reporting_scope");
    }
    return { ...scope, kind: scope.kind, staffIds: [requestedStaffId] };
  }

  /**
   * Assert the caller may act on `subjectStaffId`, and that it is not themselves.
   *
   * Approval routes use this: a reviewer must be *above* the subject, so a
   * manager can never approve their own expense or leave by virtue of being in
   * their own scope. Org-wide holders are covered by the same self-check.
   */
  async assertCanActOn(auth: StaffAuth, subjectStaffId: string): Promise<void> {
    if (auth.staffId === subjectStaffId) {
      throw new ScopeError(403, "self_approval_forbidden");
    }
    if (auth.permissions.includes(Permissions.ORG_VIEW_ALL)) return;
    const inTree = await this.hierarchy.isInReportingTree(auth.staffId, subjectStaffId);
    if (!inTree) throw new ScopeError(403, "outside_reporting_scope");
  }
}

export const scopeResolver = new ScopeResolver();
