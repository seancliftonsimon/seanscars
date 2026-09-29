/** A readable message for a failed Firestore call, with a hint for denied writes. */
export function errorMessage(err: unknown): string {
  const code = (err as { code?: string }).code;
  if (code === 'permission-denied') return 'Permission denied. Have the planner security rules been published?';
  return err instanceof Error ? err.message : String(err);
}
