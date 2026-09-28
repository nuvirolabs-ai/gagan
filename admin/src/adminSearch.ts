import { ADMIN_ACTIONS, ADMIN_NAV_GROUPS, ADMIN_UNAVAILABLE, type AdminDestination } from "./navigation";

export type AdminSearchResult = AdminDestination & { kind: "page" | "action" | "unavailable" };

const pages: AdminSearchResult[] = ADMIN_NAV_GROUPS.flatMap((group) => group.destinations.map((destination) => ({ ...destination, kind: "page" as const })));
const actions: AdminSearchResult[] = ADMIN_ACTIONS.map((destination) => ({ ...destination, kind: "action" as const }));
const unavailable: AdminSearchResult[] = ADMIN_UNAVAILABLE.map((destination) => ({ ...destination, kind: "unavailable" as const }));
const searchable = [...pages, ...actions, ...unavailable];

const recentSearches: string[] = [];

export function rememberAdminSearch(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const next = [trimmed, ...recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
  recentSearches.splice(0, recentSearches.length, ...next);
}

export function recentAdminSearches() {
  return [...recentSearches];
}

export function clearRecentAdminSearches() {
  recentSearches.splice(0, recentSearches.length);
}

export function canAccess(held: readonly string[], needed: readonly string[]) {
  return needed.some((permission) => held.includes(permission));
}

export function permissionsFor(id: string) {
  const destination = searchable.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown admin destination: ${id}`);
  return destination.permissions;
}

export function adminGroupLabel(group: AdminDestination["group"]) {
  return ADMIN_NAV_GROUPS.find((item) => item.id === group)?.label ?? group;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function editDistance(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    let best = row[0];
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + cost);
      previous = current;
      if (row[j] < best) best = row[j];
    }
    if (best > 2) return 3;
  }
  return row[right.length];
}

function tokenScore(token: string, field: string) {
  const normalized = normalize(field);
  if (!normalized) return 0;
  if (normalized === token) return 100;
  const words = normalized.split(" ").filter(Boolean);
  if (words.includes(token)) return 92;
  if (normalized.includes(token)) return 78;
  if (token.length < 5) return 0;
  const limit = token.length >= 8 ? 2 : 1;
  let best = 0;
  for (const word of words) {
    if (Math.abs(word.length - token.length) > limit) continue;
    const distance = editDistance(token, word);
    if (distance > 0 && distance <= limit) best = Math.max(best, 64 - distance * 8);
  }
  return best;
}

function matchScore(query: string, destination: AdminDestination) {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return 0;
  const fields = [destination.label, destination.keywords.join(" "), destination.description, destination.id.replace(/-/g, " ")];
  let total = 0;
  for (const token of tokens) {
    const best = Math.max(...fields.map((field) => tokenScore(token, field)));
    if (best <= 0) return 0;
    total += best;
  }
  return total;
}

function routePath(route: string | null) {
  return route?.split("?")[0] ?? null;
}

function matchesPath(path: string, pathname: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function contextScore(destination: AdminDestination, pathname: string) {
  const path = routePath(destination.route);
  const current = path ? matchesPath(path, pathname) : false;
  const related = destination.relatedTo.some((item) => matchesPath(item, pathname));
  return (current ? 500 : 0) + (related ? 80 : 0);
}

export function searchAdmin(query: string, options: { permissions: readonly string[]; pathname: string }) {
  const allowed = searchable.filter((destination) => canAccess(options.permissions, destination.permissions));
  const trimmed = query.trim();
  if (!trimmed) {
    return allowed
      .filter((destination) => destination.kind === "page")
      .map((destination, index) => ({ destination, score: contextScore(destination, options.pathname) + (allowed.length - index) }))
      .sort((left, right) => right.score - left.score || left.destination.label.localeCompare(right.destination.label))
      .map((item) => item.destination);
  }
  return allowed
    .map((destination, index) => ({ destination, index, score: matchScore(trimmed, destination) + contextScore(destination, options.pathname) }))
    .filter((item) => item.score > contextScore(item.destination, options.pathname))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.destination);
}
