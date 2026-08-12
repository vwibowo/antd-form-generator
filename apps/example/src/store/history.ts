/**
 * Snapshot undo/redo, shared by both document stores.
 *
 * Whole-document snapshots rather than per-key patches: a document is small,
 * the stores already `structuredClone` on every edit, and it means no mutation
 * has to describe its own inverse.
 */

export const HISTORY_LIMIT = 50;

/** Push the outgoing document, keeping the stack bounded. */
export function pushHistory<T>(past: T[], current: T): T[] {
  return [...past, current].slice(-HISTORY_LIMIT);
}

/** Take the most recent snapshot off a stack. `null` when there is none. */
export function popHistory<T>(stack: T[]): { head: T; rest: T[] } | null {
  if (stack.length === 0) return null;
  return { head: stack[stack.length - 1], rest: stack.slice(0, -1) };
}
