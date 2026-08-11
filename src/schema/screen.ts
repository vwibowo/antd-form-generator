import { z } from 'zod';
import { createId } from '@/lib/ids';
import { nodeBaseSchema } from './nodeBase';
import { tableSchemaSchema } from './table';

// The condition language lives a level down so `nodeBase.ts` can stay free of
// everything else; callers reach for it at this path and need not know that.
export {
  CONDITION_OPERATORS,
  conditionGroupSchema,
  conditionOperatorSchema,
  conditionSchema,
  UNARY_OPERATORS,
} from './nodeBase';
export type { Condition, ConditionGroup, ConditionOperator } from './nodeBase';

/**
 * The screen document — one contract for a thing that asks, tells, or both.
 *
 * Replaces the separate `form` and `page` documents. They were the same type
 * wearing different names: an identical five-key core (`nodeBaseSchema`), the
 * same condition language, the same registry-with-`supports` idiom, and the
 * same place inside a workflow node. Keeping them apart made the commonest real
 * screen impossible to build — a heading, a paragraph, three fields, a callout
 * and a submit is a wizard step, and it needed half of each document.
 *
 * A `table` stays its own document: it is a component with a data source, paging
 * and selection of its own, and a screen embeds one as a node.
 */

/* -------------------------------------------------------------------------- */
/* Validation rules                                                            */
/* -------------------------------------------------------------------------- */

export const ruleSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('required'), message: z.string().optional() }),
  z.object({ kind: z.literal('min'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('max'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('len'), value: z.number(), message: z.string().optional() }),
  z.object({ kind: z.literal('pattern'), value: z.string(), message: z.string().optional() }),
  z.object({
    kind: z.literal('type'),
    value: z.enum(['email', 'url', 'number', 'integer']),
    message: z.string().optional(),
  }),
]);
export type RuleSpec = z.infer<typeof ruleSpecSchema>;
export type RuleKind = RuleSpec['kind'];

/* -------------------------------------------------------------------------- */
/* Options                                                                     */
/* -------------------------------------------------------------------------- */

export const selectOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

/**
 * A nested option, for the two types that need a hierarchy — `cascader` and
 * `treeSelect`.
 *
 * Kept separate from `selectOptionSchema` rather than making that one
 * recursive. `options` is read by `useRemoteOptions`, `formatFieldValue`,
 * `OptionsEditor`, `OptionsSource` and the summary renderer; making it nestable
 * would force all five to handle a shape that every other type never produces.
 */
const treeOptionBase = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});

export type TreeOption = z.infer<typeof treeOptionBase> & {
  children?: TreeOption[];
};

export const treeOptionSchema: z.ZodType<TreeOption> = treeOptionBase.extend({
  children: z.lazy(() => z.array(treeOptionSchema)).optional(),
});

/** Server-side search settings. Honoured only for `select`. */
export const remoteSearchSchema = z.object({
  /** Query parameter carrying the typed term, e.g. `q`. */
  param: z.string().default('q'),
  /** Milliseconds to settle after the last keystroke before firing. */
  debounceMs: z.number().int().min(0).max(5000).default(300),
  /** Do not fire until the term is at least this long. */
  minChars: z.number().int().min(0).max(10).default(0),
});
export type RemoteSearch = z.infer<typeof remoteSearchSchema>;

/**
 * Where a node's options come from when they are not authored inline.
 * Fetched by the browser at render time — see `src/renderer/remote/`.
 *
 * Deliberately GET-only, with no headers/auth/body field: everything here is
 * persisted to localStorage and included in exported JSON, so a token typed
 * into the inspector would leak into every share. Auth, if it is ever needed,
 * belongs on a runtime prop of `ScreenRenderer` — never in the schema.
 */
export const dataSourceSchema = z.object({
  kind: z.literal('remote').default('remote'),
  /** http(s) URL. `{{fieldName}}` is replaced with a live value. */
  url: z.string().default(''),
  /** Dot path to the array inside the response. Blank = the response itself. */
  dataPath: z.string().default(''),
  /** Dot path within each item for the option label. */
  labelKey: z.string().default('label'),
  /** Dot path within each item for the option value. */
  valueKey: z.string().default('value'),
  /** Present = server-side search. Absent = fetch once, filter client-side. */
  search: remoteSearchSchema.optional(),
});
export type DataSource = z.infer<typeof dataSourceSchema>;

export const listConfigSchema = z.object({
  addText: z.string().default('Add item'),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().positive().optional(),
});
export type ListConfig = z.infer<typeof listConfigSchema>;

/* -------------------------------------------------------------------------- */
/* Display payloads                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One call-to-action button.
 *
 * `id` is what lands in the run payload when the button is pressed, so this is
 * an outcome in the same sense `approvalOutcomeSchema` is one — a branch tests
 * it with an ordinary `eq` condition, and there is no second routing mechanism.
 */
export const screenActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(['primary', 'default', 'dashed', 'link', 'text']).default('primary'),
  danger: z.boolean().default(false),
});
export type ScreenAction = z.infer<typeof screenActionSchema>;

/** One row of a `dataList`. `value` takes `{{token}}`, so it can combine keys. */
export const dataListItemSchema = z.object({
  label: z.string(),
  value: z.string().default(''),
});
export type DataListItem = z.infer<typeof dataListItemSchema>;

/* -------------------------------------------------------------------------- */
/* Node types                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything a screen can hold: the 24 form controls, `custom`, the three
 * containers, and the display nodes a page used to own.
 *
 * Two reconciliations from the merge. `divider` existed in both — the form's
 * won, because it renders `label` as inline text and the page's rendered
 * nothing, so the page's is the same node with a blank label. And the form's
 * `title` and the page's `heading` were one type described twice; `heading` won
 * and migration moves `label` into `text`.
 */
export const SCREEN_NODE_TYPES = [
  // Controls that collect a value.
  'input',
  'textarea',
  'password',
  'number',
  'otp',
  'autoComplete',
  'mentions',
  'select',
  'radio',
  'checkboxGroup',
  'checkbox',
  'switch',
  'segmented',
  'cascader',
  'treeSelect',
  'transfer',
  'date',
  'dateRange',
  'time',
  'timeRange',
  'slider',
  'rate',
  'colorPicker',
  'upload',
  // Host-supplied control. `props.component` names an entry in the runtime
  // component registry — the JSON never carries code, only that name.
  'custom',
  // Containers.
  'group',
  'card',
  'list',
  // Layout.
  'divider',
  'spacer',
  // Content.
  'heading',
  'text',
  'image',
  'alert',
  // Data.
  'dataList',
  'summary',
  'table',
  // The way onward.
  'actions',
] as const;

export const screenNodeTypeSchema = z.enum(SCREEN_NODE_TYPES);
export type ScreenNodeType = z.infer<typeof screenNodeTypeSchema>;

/** Types that hold children and can be dropped into. */
export const CONTAINER_TYPES = ['group', 'card', 'list'] as const;

/**
 * Containers that are chrome only: they contribute no key to the payload, and
 * their children stay at the parent's scope. A `list` is the opposite — it owns
 * a name and nests its children under it.
 */
export const TRANSPARENT_CONTAINER_TYPES = ['group', 'card'] as const;

/**
 * Types that show something rather than ask for it. Everything a page document
 * used to be made of, plus the form's own `divider`.
 */
export const DISPLAY_TYPES = [
  'divider',
  'spacer',
  'heading',
  'text',
  'image',
  'alert',
  'dataList',
  'summary',
  'table',
  'actions',
] as const;

export function isContainerType(type: ScreenNodeType): boolean {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}

export function isTransparentContainer(type: ScreenNodeType): boolean {
  return (TRANSPARENT_CONTAINER_TYPES as readonly string[]).includes(type);
}

export function isDisplayType(type: ScreenNodeType): boolean {
  return (DISPLAY_TYPES as readonly string[]).includes(type);
}

/**
 * Whether this node owns a key in the payload — the single flag that makes the
 * merged type coherent.
 *
 * Derived rather than listed, so a new type cannot be added to one list and
 * forgotten in the other. It gates whether the inspector offers `name`, `rules`
 * and `defaultValue`, whether the renderer emits a `<Form.Item>`, whether
 * `collectPayloadKeys` counts the node, and whether the screen needs a `<Form>`
 * around it at all.
 *
 * Lives here rather than in the registry because `src/renderer/` switches on
 * `type` directly and must never import builder metadata — the same rule
 * `useRemoteOptions` follows for its own type gate.
 */
export function collectsValue(type: ScreenNodeType): boolean {
  return !isDisplayType(type) && !isTransparentContainer(type);
}

/* -------------------------------------------------------------------------- */
/* Nodes                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One node with optional per-type payloads — the idiom `FieldNode`,
 * `PageBlock` and `WorkflowNode` all already used, now with the two former
 * sets of optional keys in one place.
 *
 * `label` and `text` both survive and mean different things: `label` is the
 * `Form.Item` label a control carries, `text` is the content a display node
 * shows. A node carrying the one it does not use is the same harmlessness as
 * `options` on a `divider`.
 */
const screenNodeBase = nodeBaseSchema.extend({
  type: screenNodeTypeSchema,

  /* --- collecting nodes ---------------------------------------------------- */
  /** Form.Item name segment. Ignored by display types. */
  name: z.string().default(''),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  tooltip: z.string().optional(),
  extra: z.string().optional(),
  defaultValue: z.unknown().optional(),
  disabled: z.boolean().default(false),
  rules: z.array(ruleSpecSchema).default([]),
  options: z.array(selectOptionSchema).optional(),
  /** Hierarchical options, for `cascader` and `treeSelect` only. */
  treeOptions: z.array(treeOptionSchema).optional(),
  /** Remote option source. When present it supersedes `options` at render time. */
  dataSource: dataSourceSchema.optional(),
  listConfig: listConfigSchema.optional(),

  /* --- display nodes ------------------------------------------------------- */
  /** `heading` / `text` / `alert` — `{{token}}` is substituted from the payload. */
  text: z.string().default(''),
  /** `image` — an http(s) URL. No auth field, for the reason `dataSource` has none. */
  src: z.string().default(''),
  alt: z.string().default(''),
  /** `dataList` — the rows to show. */
  items: z.array(dataListItemSchema).optional(),
  /** `actions` — the buttons. Pressing one writes its id under the screen's name. */
  actions: z.array(screenActionSchema).optional(),
  /** `table` — a whole embedded table document. */
  table: tableSchemaSchema.optional(),
  /**
   * `summary` — id of the workflow screen node whose fields lay the payload
   * out. A payload on its own has no layout, so an unset source renders
   * nothing; a standalone screen leaves this blank.
   */
  summarySource: z.string().optional(),
});

export type ScreenNode = z.infer<typeof screenNodeBase> & {
  children?: ScreenNode[];
};

export const screenNodeSchema: z.ZodType<ScreenNode> = screenNodeBase.extend({
  children: z.lazy(() => z.array(screenNodeSchema)).optional(),
});

/* -------------------------------------------------------------------------- */
/* Root screen schema                                                          */
/* -------------------------------------------------------------------------- */

export const SCREEN_SCHEMA_VERSION = 1;

export const screenSchemaSchema = z.object({
  version: z.number().int().default(SCREEN_SCHEMA_VERSION),
  /** Discriminator so an import can tell the three documents apart. */
  kind: z.literal('screen').default('screen'),
  title: z.string().optional(),
  description: z.string().optional(),

  // From the form document: how a control sits next to its label.
  layout: z.enum(['horizontal', 'vertical', 'inline']).default('vertical'),
  labelCol: z.object({ span: z.number().int().min(1).max(24) }).optional(),
  wrapperCol: z.object({ span: z.number().int().min(1).max(24) }).optional(),
  size: z.enum(['small', 'middle', 'large']).default('middle'),
  colon: z.boolean().default(true),
  gutter: z.number().int().nonnegative().default(16),

  /**
   * From the page document: content centred in a column. Unset means full
   * width, which is what every migrated form gets — a form was never centred,
   * and quietly boxing one in would change how existing documents look.
   */
  maxWidth: z.number().int().positive().optional(),

  /**
   * The built-in submit row. Suppressed when the screen has an `actions` node —
   * see `collectScreenActions`.
   */
  submitText: z.string().default('Submit'),
  showReset: z.boolean().default(true),

  nodes: z.array(screenNodeSchema).default([]),
  props: z.record(z.string(), z.unknown()).default({}),
});

export type ScreenSchema = z.infer<typeof screenSchemaSchema>;

export function createEmptyScreenSchema(): ScreenSchema {
  return screenSchemaSchema.parse({ nodes: [] });
}

export type ScreenParseResult =
  | { ok: true; schema: ScreenSchema }
  | { ok: false; errors: string[] };

/** Validate unknown JSON against the contract. Never throws. */
export function parseScreenSchema(input: unknown): ScreenParseResult {
  const result = screenSchemaSchema.safeParse(input);
  if (result.success) return { ok: true, schema: result.data };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Depth-first walk over a screen's nodes, containers included. */
export function walkScreenNodes(nodes: ScreenNode[]): ScreenNode[] {
  const out: ScreenNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children) out.push(...walkScreenNodes(node.children));
  }
  return out;
}

/**
 * Every action id this screen can write, deduped in document order.
 *
 * The page version scanned a flat list; a screen nests, so an `actions` node
 * inside a card counts too. A workflow branch needs these to know which buttons
 * it can test for.
 */
export function collectScreenActions(schema: ScreenSchema): ScreenAction[] {
  const seen = new Set<string>();
  const out: ScreenAction[] = [];
  for (const node of walkScreenNodes(schema.nodes)) {
    if (node.type !== 'actions' || node.hidden) continue;
    for (const action of node.actions ?? []) {
      if (action.id === '' || seen.has(action.id)) continue;
      seen.add(action.id);
      out.push(action);
    }
  }
  return out;
}

/** True when at least one node owns a payload key, so a `<Form>` is warranted. */
export function screenCollectsValues(schema: ScreenSchema): boolean {
  return walkScreenNodes(schema.nodes).some((node) => collectsValue(node.type));
}

/**
 * Whether the built-in submit row should render.
 *
 * An `actions` node is the way onward when there is one, and showing a second
 * set of buttons underneath it would leave the reader two ways to do the same
 * thing. Otherwise a screen that collects anything needs a way to submit it.
 */
export function showsSubmitRow(schema: ScreenSchema): boolean {
  return collectScreenActions(schema).length === 0 && screenCollectsValues(schema);
}

/** True when nothing on this screen can move a run forward. */
export function hasNoWayOnward(schema: ScreenSchema): boolean {
  return collectScreenActions(schema).length === 0 && !screenCollectsValues(schema);
}

/** Fresh id for a node, matching how fields and blocks got theirs. */
export function createScreenNodeId(type: ScreenNodeType): string {
  return createId(type);
}
