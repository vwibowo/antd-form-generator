import type { CellFormat, TableSchema } from '@antd-form-generator/core';
import { parseTableSchema } from '@antd-form-generator/core';
import type { Submission } from './submissions';

/**
 * Build a table document out of whatever has been submitted.
 *
 * The inbox is the one page here that renders a document nobody authored. Every
 * other route loads a schema someone drew in the builder; this one *computes*
 * one — a column per payload key seen across the submissions, formats guessed
 * from the values — and hands it to the same `TableRenderer`.
 *
 * That is the point worth making: a schema is data. The builder is a convenient
 * way to produce it, not the only way, and nothing downstream can tell the
 * difference between a document that was drawn and one generated a millisecond
 * ago — it goes through `parseTableSchema` like any other.
 *
 * The rows ride inside the document as a `static` source, which is what that
 * source kind is for. Fine at demo scale; a real inbox would point a `remote`
 * source at an endpoint instead, and only the `source` block would differ.
 */

const MAX_VALUE_COLUMNS = 6;

/** Guess a cell format from the values actually present under a key. */
function formatFor(values: unknown[]): CellFormat {
  const present = values.filter((value) => value !== undefined && value !== null);
  if (present.length === 0) return 'text';
  if (present.every((value) => typeof value === 'boolean')) return 'boolean';
  if (present.every((value) => typeof value === 'number')) return 'number';
  // Dates leave a form as ISO strings, which is what `serializeValues` writes.
  if (present.every((value) => typeof value === 'string' && ISO_DATE.test(value))) return 'date';
  return 'text';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

/** A payload value flattened to something a cell can print. */
function cellValue(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return Object.keys(value as object).join(', ');
  return value;
}

export interface InboxTable {
  schema: TableSchema;
  rows: Record<string, unknown>[];
}

export function buildInboxTable(submissions: Submission[]): InboxTable {
  // Key frequency across every payload, so the columns are the fields most
  // submissions actually carry rather than whatever the newest one happened to
  // have. Insertion order breaks ties, which keeps the layout stable.
  const counts = new Map<string, number>();
  for (const entry of submissions) {
    for (const key of Object.keys(entry.payload)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const valueKeys = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_VALUE_COLUMNS)
    .map(([key]) => key);

  const rows = submissions.map((entry) => {
    const row: Record<string, unknown> = {
      id: entry.id,
      document: entry.documentTitle,
      submittedAt: entry.submittedAt,
    };
    for (const key of valueKeys) row[key] = cellValue(entry.payload[key]);
    return row;
  });

  const columns = [
    {
      id: 'c_document',
      key: 'document',
      title: 'Document',
      format: 'text' as const,
      sortable: true,
      filterable: true,
    },
    {
      id: 'c_submitted',
      key: 'submittedAt',
      title: 'Received',
      format: 'date' as const,
      sortable: true,
      props: { format: 'DD/MM/YYYY HH:mm' },
    },
    ...valueKeys.map((key) => ({
      id: `c_${key}`,
      key,
      title: key,
      format: formatFor(submissions.map((entry) => entry.payload[key])),
      ellipsis: true,
    })),
  ];

  // Through the parser like any other document: the synthesised object is only
  // a `TableSchema` if the schema says so, and defaults get filled the same way.
  const result = parseTableSchema({
    kind: 'table',
    title: 'Received submissions',
    description: 'This table was generated from the payloads, not authored.',
    source: { kind: 'static', rows },
    columns,
    // The submission id, so the keys `onSelectionChange` reports are the ids the
    // inbox needs to open one — without this the renderer falls back to the row
    // index and the host would have to map it back.
    rowKey: 'id',
    selection: { enabled: true },
    props: { pageSize: 8 },
    search: { enabled: true },
  });

  if (result.ok) return { schema: result.schema, rows };

  // Cannot happen with the shape above, but an inbox that throws is worse than
  // one that is briefly empty — and an empty table document always parses.
  const empty = parseTableSchema({ kind: 'table', source: { kind: 'static', rows: [] } });
  if (!empty.ok) throw new Error('An empty table document failed to parse');
  return { schema: empty.schema, rows: [] };
}
