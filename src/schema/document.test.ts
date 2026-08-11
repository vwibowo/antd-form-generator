import { describe, expect, it } from 'vitest';
import { FIXTURES, fixturesOfKind } from './__fixtures__';
import type { DocumentKind } from './document';
import { parseDocument } from './document';

/**
 * What each frozen sample opens as now that `form` and `page` are one `screen`.
 *
 * These fixtures were written before the merge and are never regenerated, so
 * they are exactly the legacy JSON a saved file or an old localStorage blob
 * still holds. Everything here is about the reading path; that nothing was
 * *lost* on the way through is `migrate.test.ts`'s job.
 */

/** A fixture's filename prefix, mapped to the kind it opens as today. */
const OPENS_AS: Record<string, DocumentKind> = {
  form: 'screen',
  page: 'screen',
  table: 'table',
  workflow: 'workflow',
};

describe('fixtures', () => {
  it('has fixtures for every legacy kind', () => {
    expect(fixturesOfKind('form').length).toBeGreaterThan(0);
    expect(fixturesOfKind('page').length).toBeGreaterThan(0);
    expect(fixturesOfKind('table').length).toBeGreaterThan(0);
    expect(fixturesOfKind('workflow').length).toBeGreaterThan(0);
  });

  it.each(FIXTURES)('$file opens as the right kind', ({ kind, document }) => {
    const result = parseDocument(document);
    // Narrowing on `ok` first gives a readable failure: the errors, not `false`.
    if (!result.ok) expect.unreachable(result.errors.join('\n'));
    expect(result.kind).toBe(OPENS_AS[kind]);
  });

  it.each(FIXTURES)('$file settles after one read', ({ document }) => {
    const first = parseDocument(document);
    if (!first.ok) expect.unreachable('fixture does not parse');

    // Migration plus zod defaults have to reach a fixed point on the first
    // pass. If they do not, every save/load cycle would keep rewriting the
    // document — and `migrateToScreen` runs on every read, not just once.
    const again = parseDocument(JSON.parse(JSON.stringify(first.schema)));
    if (!again.ok) expect.unreachable(again.errors.join('\n'));
    expect(again.schema).toEqual(first.schema);
  });

  it('still opens a document that never had a `kind` key', () => {
    // The shape every export written before tables existed has.
    const result = parseDocument({ fields: [{ id: 'a', type: 'input', name: 'email' }] });
    if (!result.ok) expect.unreachable(result.errors.join('\n'));
    expect(result.kind).toBe('screen');
    expect(result.schema).toMatchObject({ nodes: [{ type: 'input', name: 'email' }] });
  });
});
