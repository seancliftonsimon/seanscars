/**
 * Mirrors the `isPlanner()` security rule: a verified email that appears in
 * `plannerConfig/access.emails`. Comparison ignores case and surrounding
 * whitespace (the rule itself compares exactly).
 */
export function isEmailAllowed(
  email: string | null | undefined,
  emailVerified: boolean,
  allowList: ReadonlyArray<unknown> | null | undefined,
): boolean {
  if (!email || !emailVerified || !Array.isArray(allowList)) return false;
  const wanted = email.trim().toLowerCase();
  return allowList.some((entry) => typeof entry === 'string' && entry.trim().toLowerCase() === wanted);
}
