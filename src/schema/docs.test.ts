import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCREEN_NODE_TYPES } from './screen';
import { isValid, validateDocument } from './validate';

/**
 * `docs/SCHEMA.md` has to stay true.
 *
 * It is the whole input for anyone — or anything — authoring a document without
 * the builder, so a worked example that no longer validates is worse than no
 * example: it teaches the mistake. The generated tables cannot drift because
 * `gen:schema-doc` rebuilds them, but the hand-written JSON around them can.
 */

const DOC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'SCHEMA.md');
const doc = readFileSync(DOC, 'utf8');

/** The ```json fences only — ```jsonc ones carry comments and are illustrative. */
function workedExamples(): string[] {
  return [...doc.matchAll(/```json\n(\{[\s\S]*?\n\})\n```/g)].map((match) => match[1]);
}

describe('docs/SCHEMA.md', () => {
  it('has worked examples', () => {
    expect(workedExamples().length).toBeGreaterThanOrEqual(2);
  });

  it.each(workedExamples().map((source, index) => ({ index, source })))(
    'worked example $index is valid',
    ({ source }) => {
      const result = validateDocument(JSON.parse(source));
      const errors = result.diagnostics.filter((entry) => entry.level === 'error');
      // Named so a failure says which rule the doc is teaching wrongly.
      expect(errors.map((entry) => `${entry.code}: ${entry.message}`)).toEqual([]);
      expect(isValid(result)).toBe(true);
    },
  );

  it('documents every node type', () => {
    // The table is generated, so this really checks that `gen:schema-doc` was
    // run after the type set last changed.
    const missing = SCREEN_NODE_TYPES.filter((type) => !doc.includes(`| \`${type}\` |`));
    expect(missing).toEqual([]);
  });

  it('keeps its generated blocks intact', () => {
    for (const name of ['node-types', 'workflow-kinds', 'condition-operators']) {
      expect(doc).toContain(`<!-- generated:${name} -->`);
      expect(doc).toContain(`<!-- /generated:${name} -->`);
    }
  });
});
