import { z } from 'zod';
import { createId } from '../lib/ids';
import { readPath } from '../renderer/remote/mapOptions';

/**
 * The table document — the JSON contract for "show me this list as a table".
 *
 * A sibling of `schema.ts`, not an extension of it: a table submits nothing, so
 * none of the form machinery (names, rules, conditions, payload keys) applies.
 * Same rules as that file, though — zod is the single source of truth, the TS
 * types are inferred from it, and `parseTableSchema` never throws.
 */

export const CELL_FORMATS = ['text', 'number', 'date', 'boolean'] as const;
export const cellFormatSchema = z.enum(CELL_FORMATS);
export type CellFormat = z.infer<typeof cellFormatSchema>;

export const tableColumnSchema = z.object({
  /** Builder identity and dnd key. Never part of the rendered output. */
  id: z.string(),
  /** Dot path into a row, e.g. `user.name`. */
  key: z.string(),
  /** Header text — this is what "rename a column" writes. */
  title: z.string(),
  width: z.number().int().positive().optional(),
  align: z.enum(['left', 'center', 'right']).default('left'),
  fixed: z.enum(['left', 'right']).optional(),
  ellipsis: z.boolean().default(false),
  /** Kept in the document but not rendered — a hide, not a delete. */
  hidden: z.boolean().default(false),
  sortable: z.boolean().default(false),
  /** Adds a header dropdown listing the values found in the data. */
  filterable: z.boolean().default(false),
  /** `server` paging only: query parameter name. Blank = the column's own key. */
  filterParam: z.string().default(''),
  format: cellFormatSchema.default('text'),
  /** Format-specific options: precision, date pattern, true/false text. */
  props: z.record(z.string(), z.unknown()).default({}),
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

/**
 * A bulk action offered while rows are selected.
 *
 * The document describes the intent only — label and id. What actually happens
 * belongs to the app embedding the table, which receives the id and the picked
 * rows through `onAction`.
 */
export const tableActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  danger: z.boolean().default(false),
  /** Stays disabled until this many rows are picked. */
  minSelected: z.number().int().min(1).default(1),
});
export type TableAction = z.infer<typeof tableActionSchema>;

export const tableSelectionSchema = z.object({
  enabled: z.boolean().default(false),
  type: z.enum(['checkbox', 'radio']).default('checkbox'),
  /** Keep keys picked on other pages — antd `preserveSelectedRowKeys`. */
  preserveAcrossPages: z.boolean().default(false),
  fixed: z.boolean().default(false),
  hideSelectAll: z.boolean().default(false),
  columnWidth: z.number().int().positive().optional(),
  actions: z.array(tableActionSchema).default([]),
});
export type TableSelection = z.infer<typeof tableSelectionSchema>;

export const tableSearchSchema = z.object({
  enabled: z.boolean().default(false),
  placeholder: z.string().default('Search'),
  /** Column ids to match against. Empty = every visible column. */
  columnIds: z.array(z.string()).default([]),
  /** `server` paging only: the query parameter carrying the term. */
  param: z.string().default('q'),
  debounceMs: z.number().int().min(0).max(5000).default(300),
});
export type TableSearch = z.infer<typeof tableSearchSchema>;

/**
 * Where the rows come from.
 *
 * Deliberately GET-only with no headers or auth field, for the same reason
 * `dataSourceSchema` is: this document is persisted to localStorage, shown in
 * the JSON tab and included in every export, so a token typed here would leak
 * into every share.
 */
export const tableSourceSchema = z.object({
  kind: z.enum(['static', 'remote']).default('static'),

  /** `static` — rows authored inline. */
  rows: z.array(z.record(z.string(), z.unknown())).default([]),

  /** `remote` — http(s) URL. `{{token}}` is replaced from `params`. */
  url: z.string().default(''),
  /** Dot path to the array inside the response. Blank = the response itself. */
  dataPath: z.string().default(''),

  /**
   * `client` fetches once and lets antd page, sort and filter in the browser.
   * `server` sends page/size on every change and reads the total from the body.
   */
  paging: z.enum(['client', 'server']).default('client'),
  pageParam: z.string().default('page'),
  sizeParam: z.string().default('pageSize'),
  /** Some APIs count pages from 0, and some take an offset — see `pageMode`. */
  pageStart: z.number().int().min(0).max(1).default(1),
  /** `page` sends a page number; `offset` sends how many rows to skip. */
  pageMode: z.enum(['page', 'offset']).default('page'),
  /** Dot path to the row count. Blank = paging controls cannot show a total. */
  totalPath: z.string().default(''),

  /** Blank turns server-side sorting off; columns then sort the current page. */
  sortParam: z.string().default(''),
  orderParam: z.string().default('order'),
  ascValue: z.string().default('asc'),
  descValue: z.string().default('desc'),
});
export type TableSource = z.infer<typeof tableSourceSchema>;

export const TABLE_SCREEN_SCHEMA_VERSION = 1;

export const tableSchemaSchema = z.object({
  version: z.number().int().default(TABLE_SCREEN_SCHEMA_VERSION),
  /** Discriminator so an import can tell the two documents apart. */
  kind: z.literal('table').default('table'),
  title: z.string().optional(),
  description: z.string().optional(),
  // A function default so the seed is the parsed shape, not a hand-written
  // literal that could drift from `tableSourceSchema`'s own defaults.
  source: tableSourceSchema.default(() => tableSourceSchema.parse({})),
  /** Dot path to a stable row id. Blank falls back to the row index. */
  rowKey: z.string().default(''),
  /** Values for `{{token}}` in the URL — the seam for a future filter bar. */
  params: z.record(z.string(), z.string()).default({}),
  selection: tableSelectionSchema.default(() => tableSelectionSchema.parse({})),
  search: tableSearchSchema.default(() => tableSearchSchema.parse({})),
  columns: z.array(tableColumnSchema).default([]),
  /** Table-level antd props, same free-form bag as a field's `props`. */
  props: z.record(z.string(), z.unknown()).default({}),
});

export type TableSchema = z.infer<typeof tableSchemaSchema>;

export function createEmptyTableSchema(): TableSchema {
  return tableSchemaSchema.parse({});
}

export type TableParseResult =
  | { ok: true; schema: TableSchema }
  | { ok: false; errors: string[] };

/** Validate unknown JSON against the contract. Never throws. */
export function parseTableSchema(input: unknown): TableParseResult {
  const result = tableSchemaSchema.safeParse(input);
  if (result.success) return { ok: true, schema: result.data };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}

/* -------------------------------------------------------------------------- */
/* Column inference                                                            */
/* -------------------------------------------------------------------------- */

/** `unit_price` / `unitPrice` -> `Unit price`. */
export function titleCase(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (spaced === '') return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;

function guessFormat(value: unknown): CellFormat {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string' && ISO_DATE.test(value)) return 'date';
  return 'text';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Derive columns from sample rows — the "Detect columns" button.
 *
 * Reads the first row for shape and descends one level into nested objects as
 * dotted paths, which covers the common `{ user: { name } }` response without
 * turning a deep tree into fifty columns.
 */
export function inferColumns(rows: unknown[]): TableColumn[] {
  const first = rows.find(isPlainObject);
  if (!first) return [];

  const columns: TableColumn[] = [];
  const push = (key: string, value: unknown) => {
    columns.push(
      tableColumnSchema.parse({
        id: createId('col'),
        key,
        title: titleCase(key.split('.').pop() ?? key),
        format: guessFormat(value),
      }),
    );
  };

  for (const [key, value] of Object.entries(first)) {
    if (isPlainObject(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (isPlainObject(childValue) || Array.isArray(childValue)) continue;
        push(`${key}.${childKey}`, childValue);
      }
      continue;
    }
    // An array cell has no sensible column of its own; show it as text.
    push(key, value);
  }

  return columns;
}

/* -------------------------------------------------------------------------- */
/* Path collection                                                             */
/* -------------------------------------------------------------------------- */

export interface RowPath {
  /** Dot path, e.g. `reviews.0.rating`. */
  path: string;
  /** First non-empty value seen there, shown beside the path in the picker. */
  sample: unknown;
  /** What the sample looks like. Reported to the author, never applied. */
  format: CellFormat;
  /** An object or array offered whole — picking it renders the raw shape. */
  container: boolean;
}

/** Rows scanned for shape. More than one, so a null in the first cannot hide a path. */
const SAMPLE_ROWS = 5;

/**
 * Every path addressable in these rows, for the column Field picker.
 *
 * Depth and count are capped because this runs against whatever an API returned:
 * a deeply nested or very wide response must not lock the panel. Arrays are
 * sampled through their first element (`tags.0.name`), which `readPath` resolves
 * because a numeric segment indexes an array just as a key indexes an object.
 */
export function collectRowPaths(
  rows: unknown[],
  options?: { maxDepth?: number; limit?: number },
): RowPath[] {
  const maxDepth = options?.maxDepth ?? 4;
  const limit = options?.limit ?? 200;

  const found = new Map<string, RowPath>();

  const record = (path: string, sample: unknown, container: boolean) => {
    const existing = found.get(path);
    if (existing) {
      // Keep the first non-empty sample — an early null should not win.
      if (existing.sample === undefined || existing.sample === null) {
        found.set(path, { path, sample, format: guessFormat(sample), container });
      }
      return;
    }
    if (found.size >= limit) return;
    found.set(path, { path, sample, format: guessFormat(sample), container });
  };

  const visit = (value: unknown, prefix: string, depth: number) => {
    if (found.size >= limit || depth > maxDepth) return;

    if (isPlainObject(value)) {
      // The container itself is a legitimate choice: a cell renders it as JSON.
      if (prefix) record(prefix, value, true);
      for (const [key, child] of Object.entries(value)) {
        visit(child, prefix ? `${prefix}.${key}` : key, depth + 1);
      }
      return;
    }

    if (Array.isArray(value)) {
      if (prefix) record(prefix, value, true);
      if (value.length > 0) visit(value[0], `${prefix}.0`, depth + 1);
      return;
    }

    if (prefix) record(prefix, value, false);
  };

  for (const row of rows.slice(0, SAMPLE_ROWS)) {
    if (!isPlainObject(row)) continue;
    visit(row, '', 0);
  }

  return [...found.values()];
}

/** A filter list longer than this is a free-text field wearing a disguise. */
const MAX_FILTER_VALUES = 50;

/**
 * The distinct values at `path`, for a column's header filter dropdown.
 *
 * Derived rather than authored, so the list always matches the data — with the
 * caveat that under server paging the rows in hand are one page, so the list is
 * "values seen so far" rather than every value the API could return.
 */
export function collectFilterValues(
  rows: unknown[],
  path: string,
  limit = MAX_FILTER_VALUES,
): (string | number)[] {
  if (path.trim() === '') return [];

  const seen = new Set<string | number>();
  for (const row of rows) {
    if (seen.size >= limit) break;
    const value = readPath(row, path);
    if (typeof value === 'string' && value !== '') seen.add(value);
    else if (typeof value === 'number' && Number.isFinite(value)) seen.add(value);
    else if (typeof value === 'boolean') seen.add(String(value));
  }

  const values = [...seen];
  const allNumbers = values.every((value) => typeof value === 'number');
  return allNumbers
    ? (values as number[]).sort((a, b) => a - b)
    : values.sort((a, b) => String(a).localeCompare(String(b)));
}
