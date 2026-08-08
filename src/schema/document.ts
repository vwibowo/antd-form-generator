import type { FormSchema } from './schema';
import { parseFormSchema } from './schema';
import type { TableSchema } from './table';
import { parseTableSchema } from './table';

/**
 * The app edits two kinds of document. Anything that reads JSON from outside —
 * an imported file, a localStorage blob, a paste into the JSON tab — goes
 * through here so the two never get confused for one another.
 */

export type DocumentKind = 'form' | 'table';

export type DocumentParseResult =
  | { ok: true; kind: 'form'; schema: FormSchema }
  | { ok: true; kind: 'table'; schema: TableSchema }
  | { ok: false; errors: string[] };

function looksLikeTable(input: unknown): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as { kind?: unknown }).kind === 'table'
  );
}

/**
 * Dispatch on `kind`. A document without one is a form — every export written
 * before tables existed lacks the key, and those files must still import.
 */
export function parseDocument(input: unknown): DocumentParseResult {
  if (looksLikeTable(input)) {
    const result = parseTableSchema(input);
    return result.ok ? { ok: true, kind: 'table', schema: result.schema } : result;
  }

  const result = parseFormSchema(input);
  return result.ok ? { ok: true, kind: 'form', schema: result.schema } : result;
}
