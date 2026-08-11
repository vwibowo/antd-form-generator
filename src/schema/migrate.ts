/**
 * Upgrading the two legacy document shapes to a `screen`.
 *
 * Applied inside `parseScreenSchema`'s callers rather than bolted onto one
 * entry point, because legacy JSON arrives from four directions: an imported
 * file, a paste into the JSON tab, a localStorage blob written by an older
 * build, and a form or page embedded inside a stored workflow. Anything that
 * only fixed up imports would leave the other three broken.
 *
 * Deliberately untyped in and out. These are documents that no longer satisfy
 * any current contract, so the only honest signature is `unknown -> unknown`;
 * `parseScreenSchema` is what decides whether the result is a screen.
 */

import { isDisplayType } from './screen';
import type { ScreenNodeType } from './screen';

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function kindOf(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  return typeof input.kind === 'string' ? input.kind : undefined;
}

/**
 * A legacy form field, or a legacy page block, as a screen node.
 *
 * The two sets of keys were already disjoint apart from the shared base, so
 * this is a copy plus the one type rename the merge forced.
 */
function migrateNode(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const node: Record<string, unknown> = { ...input };

  // `title` and `heading` were one type described twice. The form's read its
  // text out of `label`; the page's reads `text`.
  if (node.type === 'title') {
    node.type = 'heading';
    if (typeof node.label === 'string' && node.label !== '' && !node.text) {
      node.text = node.label;
    }
    delete node.label;
  }

  // A form gave every field a `name`, including `title` and `divider`, which
  // never rendered a `Form.Item` and so never occupied a payload key. Dropping
  // it loses nothing and stops a migrated document claiming a key that
  // `collectsValue` says the node cannot have.
  if (typeof node.type === 'string' && isDisplayType(node.type as ScreenNodeType)) {
    delete node.name;
  }

  if (Array.isArray(node.children)) {
    node.children = node.children.map(migrateNode);
  }
  return node;
}

/** A legacy form document (no `kind`, `fields[]`) as a screen. */
function migrateForm(input: Record<string, unknown>): Record<string, unknown> {
  const { fields, ...rest } = input;
  return {
    ...rest,
    kind: 'screen',
    nodes: Array.isArray(fields) ? fields.map(migrateNode) : [],
  };
}

/** A legacy page document (`kind: 'page'`, `blocks[]`) as a screen. */
function migratePage(input: Record<string, unknown>): Record<string, unknown> {
  const { blocks, ...rest } = input;
  return {
    ...rest,
    kind: 'screen',
    nodes: Array.isArray(blocks) ? blocks.map(migrateNode) : [],
    // A page had no submit row and no `actions` node is required to have one,
    // so keep the row switched off rather than growing a button nobody authored.
    showReset: false,
  };
}

/**
 * Whatever this is, as something `parseScreenSchema` can read.
 *
 * A document already carrying `kind: 'screen'` passes straight through, so this
 * is safe to run on every read forever rather than only once.
 */
export function migrateToScreen(input: unknown): unknown {
  if (!isRecord(input)) return input;

  const kind = kindOf(input);
  if (kind === 'screen') return input;
  if (kind === 'page') return migratePage(input);
  // No `kind` at all is a form: every export written before tables existed
  // lacks the key, and those files must still open.
  if (kind === undefined) return migrateForm(input);

  // A table or a workflow — not this function's business.
  return input;
}

/* -------------------------------------------------------------------------- */
/* Workflow documents                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A stored workflow whose nodes still say `form` or `page`.
 *
 * Both kinds collapse into one `screen` kind, and the two payload keys collapse
 * into `screen`. A `page` node already carried a `name` because its buttons
 * wrote to the payload; a `form` node did not, and gets one derived from its id
 * so a branch can still name it.
 */
export function migrateWorkflowToScreens(input: unknown): unknown {
  if (!isRecord(input) || kindOf(input) !== 'workflow') return input;
  if (!Array.isArray(input.nodes)) return input;

  return {
    ...input,
    nodes: input.nodes.map((raw) => {
      if (!isRecord(raw)) return raw;
      if (raw.kind !== 'form' && raw.kind !== 'page') return raw;

      const { form, page, ...rest } = raw;
      const legacy = raw.kind === 'form' ? form : page;
      return {
        ...rest,
        kind: 'screen',
        screen: migrateToScreen(legacy),
      };
    }),
  };
}
