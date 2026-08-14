import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The sample documents, frozen to JSON as the pre-merge contracts produced them.
 *
 * Written once by `npm run gen:fixtures` and then left alone — see the header of
 * `scripts/genFixtures.ts`. Tests treat these as *inputs* rather than snapshots:
 * they are the legacy `form` and `page` shapes that must keep loading after the
 * merge, which is the only evidence that migrating them lost nothing.
 *
 * Filenames encode the kind they were written under: `form.*`, `page.*`,
 * `table.*`, `workflow.*`.
 */

const DIR = dirname(fileURLToPath(import.meta.url));

/** The kind a fixture was authored under, taken from its filename prefix. */
export type FixtureKind = 'form' | 'page' | 'table' | 'workflow';

export interface Fixture {
  /** e.g. `form.kitchen-sink.json` — used as the test name. */
  file: string;
  kind: FixtureKind;
  /** Parsed JSON, exactly as it sits on disk. */
  document: unknown;
}

function load(): Fixture[] {
  return readdirSync(DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      kind: file.split('.')[0] as FixtureKind,
      document: JSON.parse(readFileSync(join(DIR, file), 'utf8')),
    }));
}

export const FIXTURES: Fixture[] = load();

export function fixturesOfKind(kind: FixtureKind): Fixture[] {
  return FIXTURES.filter((fixture) => fixture.kind === kind);
}
