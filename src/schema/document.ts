import { migrateToScreen, migrateWorkflowToScreens } from './migrate';
import type { ScreenSchema } from './screen';
import { parseScreenSchema } from './screen';
import type { TableSchema } from './table';
import { parseTableSchema } from './table';
import type { WorkflowSchema } from './workflow';
import { parseWorkflowSchema } from './workflow';

/**
 * The app edits three kinds of document. Anything that reads JSON from outside —
 * an imported file, a localStorage blob, a paste into the JSON tab — goes
 * through here so they never get confused for one another.
 *
 * There used to be four: `form` and `page` were one type wearing two names and
 * are now `screen`. Both legacy shapes still arrive from saved files and older
 * localStorage, so they are migrated here rather than rejected — see
 * `migrate.ts`.
 */

export type DocumentKind = 'screen' | 'table' | 'workflow';

export type DocumentParseResult =
  | { ok: true; kind: 'screen'; schema: ScreenSchema }
  | { ok: true; kind: 'table'; schema: TableSchema }
  | { ok: true; kind: 'workflow'; schema: WorkflowSchema }
  | { ok: false; errors: string[] };

function hasKind(input: unknown, kind: string): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as { kind?: unknown }).kind === kind
  );
}

/**
 * Dispatch on `kind`.
 *
 * A document without one is a legacy form — every export written before tables
 * existed lacks the key, and those files must still import.
 */
export function parseDocument(input: unknown): DocumentParseResult {
  if (hasKind(input, 'table')) {
    const result = parseTableSchema(input);
    return result.ok ? { ok: true, kind: 'table', schema: result.schema } : result;
  }

  if (hasKind(input, 'workflow')) {
    // A stored workflow may still hold `form` and `page` nodes.
    const result = parseWorkflowSchema(migrateWorkflowToScreens(input));
    return result.ok ? { ok: true, kind: 'workflow', schema: result.schema } : result;
  }

  // `screen`, `kind: 'page'`, or no kind at all — `migrateToScreen` sorts out
  // which, and passes an already-migrated document straight through.
  const result = parseScreenSchema(migrateToScreen(input));
  return result.ok ? { ok: true, kind: 'screen', schema: result.schema } : result;
}
