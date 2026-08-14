import { describe, expect, it } from 'vitest';
import { buildInboxTable } from './inboxTable';
import type { Submission } from './submissions';

/**
 * The inbox renders a document nobody authored, so nothing but this checks it.
 *
 * The builder's own documents are guarded by the schema parsers and by whoever
 * drew them. A generated one has neither: if the column inference is wrong, the
 * table still renders — just with the wrong headers, or a date printed as text —
 * and no error appears anywhere.
 */

const at = '2026-03-01T09:00:00.000Z';

function submission(payload: Record<string, unknown>, index = 0): Submission {
  return {
    id: `sub_${index}`,
    documentId: 'doc',
    documentTitle: 'Holiday request',
    kind: 'screen',
    payload,
    submittedAt: at,
  };
}

describe('buildInboxTable', () => {
  it('parses as a real table document', () => {
    const { schema } = buildInboxTable([submission({ who: 'Ada' })]);
    // The whole claim of the page: generated or drawn, it is the same shape and
    // goes through the same parser.
    expect(schema.kind).toBe('table');
    expect(schema.source.kind).toBe('static');
    expect(schema.rowKey).toBe('id');
  });

  it('gives every payload key a column, plus the two it always has', () => {
    const { schema } = buildInboxTable([submission({ who: 'Ada', days: 3 })]);
    expect(schema.columns.map((column) => column.key)).toEqual([
      'document',
      'submittedAt',
      'who',
      'days',
    ]);
  });

  it('infers a format per column from the values under it', () => {
    const { schema } = buildInboxTable([
      submission({ who: 'Ada', days: 3, urgent: true, startsOn: '2026-04-01T00:00:00.000Z' }),
    ]);
    const format = (key: string) => schema.columns.find((column) => column.key === key)?.format;

    expect(format('who')).toBe('text');
    expect(format('days')).toBe('number');
    expect(format('urgent')).toBe('boolean');
    // Dates leave a form as ISO strings, so this is what `serializeValues` wrote.
    expect(format('startsOn')).toBe('date');
  });

  it('orders columns by how many submissions carry the key', () => {
    const { schema } = buildInboxTable([
      submission({ rare: 1, common: 1 }, 0),
      submission({ common: 2 }, 1),
      submission({ common: 3 }, 2),
    ]);
    const keys = schema.columns.map((column) => column.key);
    // A field two thirds of submissions never had should not lead the table.
    expect(keys.indexOf('common')).toBeLessThan(keys.indexOf('rare'));
  });

  it('flattens values a table cell cannot print', () => {
    const { rows } = buildInboxTable([
      submission({ lines: [1, 2, 3], meta: { team: 'platform', tier: 'gold' } }),
    ]);
    // A repeatable and a custom component's object would otherwise render as
    // `[object Object]`.
    expect(rows[0].lines).toBe('3 items');
    expect(rows[0].meta).toBe('team, tier');
  });

  it('keys rows by submission id, which is what selection reports back', () => {
    const { rows } = buildInboxTable([submission({ who: 'Ada' }, 7)]);
    // The inbox opens a submission from the key `onSelectionChange` hands over,
    // so this has to be the id and not a row index.
    expect(rows[0].id).toBe('sub_7');
  });

  it('still produces a document when there is nothing to show', () => {
    const { schema, rows } = buildInboxTable([]);
    expect(rows).toEqual([]);
    // Only the two standing columns, and no crash on an empty inbox.
    expect(schema.columns.map((column) => column.key)).toEqual(['document', 'submittedAt']);
  });
});
