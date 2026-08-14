import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { validateDocument } from '../src/schema/validate';

/**
 * Check a document the way the app would.
 *
 * ```bash
 * npm run validate path/to/screen.json [more.json …]
 * ```
 *
 * The JSON is the product, and it can arrive from anywhere — hand-authored,
 * pasted into the JSON tab, or written by an agent from a requirement. None of
 * those go near the drag-and-drop that enforces half the rules, so this runs the
 * rules instead. Every check lives in `src/schema/validate.ts`; this file is
 * only argument handling and printing.
 *
 * Exits `1` when anything is an error, `0` when the worst is a warning — a
 * document with warnings still runs, so it must not fail a commit hook.
 */

const RESET = '[0m';
const DIM = '[2m';
const RED = '[31m';
const YELLOW = '[33m';
const GREEN = '[32m';

/** Colour only when someone is watching; pipes and CI get plain text. */
const paint = (code: string, text: string) =>
  process.stdout.isTTY ? `${code}${text}${RESET}` : text;

const files = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

if (files.length === 0) {
  console.error('Usage: npm run validate <file.json> [more.json ...]');
  process.exit(2);
}

let failed = false;

for (const file of files) {
  // A file outside the repo relativises to a stack of `../`, which is longer
  // and harder to read than the path that was typed.
  const asRelative = relative(process.cwd(), file);
  const shown =
    asRelative && !asRelative.startsWith('..') && asRelative.length < file.length
      ? asRelative
      : file;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    failed = true;
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`${paint(RED, '✗')} ${shown}`);
    console.log(`  ${paint(RED, 'not JSON')}  ${reason}\n`);
    continue;
  }

  const { kind, diagnostics } = validateDocument(parsed);
  const errors = diagnostics.filter((entry) => entry.level === 'error');
  const warnings = diagnostics.filter((entry) => entry.level === 'warning');
  if (errors.length > 0) failed = true;

  const label = kind ? paint(DIM, ` (${kind})`) : '';
  if (diagnostics.length === 0) {
    console.log(`${paint(GREEN, '✓')} ${shown}${label}`);
    continue;
  }

  console.log(`${errors.length > 0 ? paint(RED, '✗') : paint(YELLOW, '!')} ${shown}${label}`);
  // Errors first: they are what has to be fixed before anything else matters.
  for (const entry of [...errors, ...warnings]) {
    const mark = entry.level === 'error' ? paint(RED, 'error') : paint(YELLOW, 'warn ');
    const where = entry.path ? paint(DIM, ` ${entry.path}`) : '';
    console.log(`  ${mark}${where}  ${entry.message}`);
  }
  console.log();
}

process.exit(failed ? 1 : 0);
