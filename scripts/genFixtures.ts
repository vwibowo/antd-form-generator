import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_PRESETS } from '@/schema/samples';
import { TABLE_SAMPLE_PRESETS } from '@/schema/samples/tables';
import { WORKFLOW_SAMPLE_PRESETS } from '@/schema/samples/workflows';

/**
 * Freeze every sample preset to JSON on disk.
 *
 * Already run once, before the form/page merge — the committed
 * `form.*` and `page.*` fixtures capture the documents exactly as the pre-merge
 * contracts produced them, and the migration tests feed those legacy shapes
 * back in to prove nothing was dropped on the way to a `screen`.
 *
 * **Re-running this will not reproduce them**, because the presets now emit
 * screens. It is kept for freezing a *future* set under new filenames; the
 * existing `form.*` and `page.*` files must never be overwritten.
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'schema', '__fixtures__');

interface Entry {
  file: string;
  document: unknown;
}

const entries: Entry[] = [
  ...SAMPLE_PRESETS.map((preset) => ({
    file: `screen.${preset.key}.json`,
    document: preset.create(),
  })),
  ...TABLE_SAMPLE_PRESETS.map((preset) => ({
    file: `table.${preset.key}.json`,
    document: preset.create(),
  })),
  ...WORKFLOW_SAMPLE_PRESETS.map((preset) => ({
    file: `workflow.${preset.key}.json`,
    document: preset.create(),
  })),
];

mkdirSync(OUT_DIR, { recursive: true });

for (const entry of entries) {
  writeFileSync(join(OUT_DIR, entry.file), `${JSON.stringify(entry.document, null, 2)}\n`);
  console.log(`wrote ${entry.file}`);
}

console.log(`\n${entries.length} fixtures in ${OUT_DIR}`);
