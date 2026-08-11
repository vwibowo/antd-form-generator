import { z } from 'zod';
import { createId } from '@/lib/ids';
import { conditionGroupSchema } from './schema';
import { tableSchemaSchema } from './table';

/**
 * The page document — the JSON contract for "show the person this screen".
 *
 * A sibling of `schema.ts`, `table.ts` and `workflow.ts`. A form asks; a page
 * tells, and offers a way onward. Same rules as the others: zod is the single
 * source of truth, the TS types are inferred from it, and `parsePageSchema`
 * never throws.
 *
 * Deliberately app screens rather than marketing pages: blocks stack in one
 * column and take a 1..24 `span`, exactly as a form field does. There is no
 * grid system and no per-block styling, because a document that carried colours
 * and breakpoints would stop being describable by a small JSON contract.
 */

export const PAGE_BLOCK_TYPES = [
  'heading',
  'text',
  'image',
  'divider',
  'spacer',
  /** Label/value rows read straight out of the payload. */
  'dataList',
  /** A form's payload laid out by that form's own fields. */
  'summary',
  /** A whole embedded table document. */
  'table',
  'alert',
  /** The call-to-action row. */
  'actions',
] as const;

export const pageBlockTypeSchema = z.enum(PAGE_BLOCK_TYPES);
export type PageBlockType = z.infer<typeof pageBlockTypeSchema>;

/** Types that render no content of their own and carry no text. */
export const PAGE_SPACER_TYPES = ['divider', 'spacer'] as const;

export function isPageSpacerType(type: PageBlockType): boolean {
  return (PAGE_SPACER_TYPES as readonly string[]).includes(type);
}

/* -------------------------------------------------------------------------- */
/* Block payloads                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One call-to-action button.
 *
 * `id` is what lands in the run payload when the button is pressed, so this is
 * an outcome in the same sense `approvalOutcomeSchema` is one — a branch tests
 * it with an ordinary `eq` condition, and there is no second routing mechanism.
 *
 * The `{ id, label, danger }` overlap with `approvalOutcomeSchema` is not shared
 * on purpose: a page is a standalone document that a workflow embeds, so
 * `page.ts` importing `workflow.ts` would point the dependency the wrong way.
 */
export const pageActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(['primary', 'default', 'dashed', 'link', 'text']).default('primary'),
  danger: z.boolean().default(false),
});
export type PageAction = z.infer<typeof pageActionSchema>;

/** One row of a `dataList`. `value` takes `{{token}}`, so it can combine keys. */
export const pageDataItemSchema = z.object({
  label: z.string(),
  value: z.string().default(''),
});
export type PageDataItem = z.infer<typeof pageDataItemSchema>;

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One flat block with optional per-type payloads, mirroring `FieldNode` and
 * `WorkflowNode` rather than a discriminated union — `updateBlock(id, patch)`
 * plus `Object.assign` is the store idiom here, and a `Partial<>` of a union
 * does not survive it. An `image` carrying an inert `actions` is the same
 * harmlessness as `options` on a `divider`.
 */
export const pageBlockSchema = z.object({
  id: z.string(),
  type: pageBlockTypeSchema,
  /** Grid width, 1..24 — drives `<Col span>` exactly as a field's does. */
  span: z.number().int().min(1).max(24).default(24),
  /** Always hidden, regardless of `condition`. */
  hidden: z.boolean().default(false),
  /**
   * Show only when this matches, evaluated against the payload the page is
   * rendered with. The same `ConditionGroup` a field's visibility uses —
   * `SummaryRenderer` already evaluates those against a static payload, so
   * nothing new is needed to make it work here.
   */
  condition: conditionGroupSchema.optional(),

  /** `heading` / `text` / `alert` — `{{token}}` is substituted from the payload. */
  text: z.string().default(''),
  /**
   * `image` — an http(s) URL. No headers or auth field, for the same reason
   * `dataSourceSchema` has none: this document is persisted, shown in the JSON
   * tab and exported, so anything secret typed here would leak with it.
   */
  src: z.string().default(''),
  alt: z.string().default(''),

  /** `dataList` — the rows to show. */
  items: z.array(pageDataItemSchema).optional(),
  /** `actions` — the buttons. One with none cannot be advanced past. */
  actions: z.array(pageActionSchema).optional(),
  /** `table` — a whole embedded table document. */
  table: tableSchemaSchema.optional(),
  /**
   * `summary` — id of the workflow `form` node whose fields lay the payload
   * out. A payload on its own has no layout, so an unset source renders
   * nothing; a standalone page leaves this blank.
   */
  summarySource: z.string().optional(),

  /** Escape hatch, the same free-form bag a field's `props` is. */
  props: z.record(z.string(), z.unknown()).default({}),
});
export type PageBlock = z.infer<typeof pageBlockSchema>;

/* -------------------------------------------------------------------------- */
/* Root page schema                                                            */
/* -------------------------------------------------------------------------- */

export const PAGE_SCHEMA_VERSION = 1;

export const pageSchemaSchema = z.object({
  version: z.number().int().default(PAGE_SCHEMA_VERSION),
  /** Discriminator so an import can tell the four documents apart. */
  kind: z.literal('page').default('page'),
  title: z.string().optional(),
  description: z.string().optional(),
  /** Content is centred in a column: an app screen reads badly full-bleed. */
  maxWidth: z.number().int().positive().default(880),
  gutter: z.number().int().nonnegative().default(16),
  blocks: z.array(pageBlockSchema).default([]),
  props: z.record(z.string(), z.unknown()).default({}),
});

export type PageSchema = z.infer<typeof pageSchemaSchema>;

export function createEmptyPageSchema(): PageSchema {
  return pageSchemaSchema.parse({ blocks: [] });
}

export type PageParseResult =
  | { ok: true; schema: PageSchema }
  | { ok: false; errors: string[] };

/** Validate unknown JSON against the contract. Never throws. */
export function parsePageSchema(input: unknown): PageParseResult {
  const result = pageSchemaSchema.safeParse(input);
  if (result.success) return { ok: true, schema: result.data };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}

/* -------------------------------------------------------------------------- */
/* Block queries                                                               */
/* -------------------------------------------------------------------------- */

export function findPageBlock(schema: PageSchema, id: string): PageBlock | null {
  return schema.blocks.find((block) => block.id === id) ?? null;
}

/**
 * Every action id a page can write, deduped in document order.
 *
 * A workflow branch needs these to know which buttons it can test for, so this
 * is what `collectWorkflowNames` reaches for on a page node.
 */
export function collectPageActions(schema: PageSchema): PageAction[] {
  const seen = new Set<string>();
  const out: PageAction[] = [];
  for (const block of schema.blocks) {
    if (block.type !== 'actions' || block.hidden) continue;
    for (const action of block.actions ?? []) {
      if (action.id === '' || seen.has(action.id)) continue;
      seen.add(action.id);
      out.push(action);
    }
  }
  return out;
}

/** True when nothing on this page can move a run forward. */
export function hasNoWayOnward(schema: PageSchema): boolean {
  return collectPageActions(schema).length === 0;
}

/** Fresh id for a block, matching how fields and nodes get theirs. */
export function createPageBlockId(type: PageBlockType): string {
  return createId(type);
}
