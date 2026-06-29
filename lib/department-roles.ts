/**
 * Canonical department-role taxonomy + consolidation of deprecated values.
 *
 * `agent.department_role` is loosely-governed visitor metadata that has
 * accumulated legacy / renamed values over time. When a role is retired we
 * keep the dashboard honest by folding the old raw value into its current
 * replacement here — every widget that groups by `department_role` runs each
 * value through `canonicalDepartmentRole` first, so the bar chart, the 30-day
 * adoption table, and the expandable per-role user lists all stay consistent.
 *
 * To deprecate a role, add one line to `DEPRECATED_DEPARTMENT_ROLES`. Keys and
 * values are the RAW snake_case strings as stored in Pendo.
 */
export const DEPRECATED_DEPARTMENT_ROLES: Record<string, string> = {
  // `sales` was retired 2026-06-29 and folded into `account_owner`.
  sales: "account_owner",
};

/**
 * Map a raw `department_role` value onto the current taxonomy. Deprecated
 * values resolve to their replacement; everything else passes through
 * (normalised to lower-case snake_case, which is how Pendo stores them).
 */
export function canonicalDepartmentRole(raw: string): string {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key || key === "—") return raw;
  return DEPRECATED_DEPARTMENT_ROLES[key] ?? key;
}

const DEPT_ROLE_ACRONYMS = new Set([
  "ic",
  "se",
  "sdr",
  "csm",
  "cse",
  "tam",
  "ps",
  "ae",
  "pm",
  "vp",
]);

/**
 * Canonicalise a raw role, then render it as a human label (snake_case →
 * Title Case, preserving common acronyms). e.g. `sales` → "Account Owner",
 * `customer_engineer` → "Customer Engineer", `csm` → "CSM".
 */
export function prettyDepartmentRole(raw: string): string {
  const canonical = canonicalDepartmentRole(raw);
  if (!canonical || canonical === "—") return canonical;
  return canonical
    .split("_")
    .map((w) => {
      if (!w) return w;
      if (DEPT_ROLE_ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Collapse grouped department-role counts onto the canonical taxonomy, summing
 * visitor counts for any deprecated values that fold into a current role (e.g.
 * `sales` + `account_owner` become a single Account Owner bucket). Returns rows
 * sorted by visitor count descending.
 */
export function consolidateDepartmentRoleCounts(
  rows: Array<{ rawRole: string; visitors: number }>,
): Array<{ rawRole: string; prettyRole: string; visitors: number }> {
  const totals = new Map<string, number>();
  for (const { rawRole, visitors } of rows) {
    const canonical = canonicalDepartmentRole(rawRole);
    totals.set(canonical, (totals.get(canonical) ?? 0) + visitors);
  }
  return [...totals.entries()]
    .map(([rawRole, visitors]) => ({
      rawRole,
      prettyRole: prettyDepartmentRole(rawRole),
      visitors,
    }))
    .sort((a, b) => b.visitors - a.visitors);
}
