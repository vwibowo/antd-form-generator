import { z } from 'zod';

/**
 * Single source of truth for the form JSON contract.
 *
 * Everything else — the TS types, the import validator, the localStorage
 * rehydration guard — is derived from the zod schemas in this file. If the
 * shape changes, it changes here and nowhere else.
 */

export const FIELD_TYPES = [
  'input',
  'textarea',
  'password',
  'number',
  'select',
  'radio',
  'checkboxGroup',
  'checkbox',
  'switch',
  'date',
  'dateRange',
  'time',
  'slider',
  'rate',
  'upload',
  'divider',
  'title',
  'group',
  'card',
  'list',
  // Host-supplied control. `props.component` names an entry in the runtime
  // component registry — the JSON never carries code, only that name.
  'custom',
] as const;

export const fieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof fieldTypeSchema>;

/** Types that hold children and can be dropped into. */
export const CONTAINER_TYPES = ['group', 'card', 'list'] as const;
/** Types that render no control and carry no form value. */
export const PRESENTATIONAL_TYPES = ['divider', 'title'] as const;
/**
 * Containers that are chrome only: they contribute no key to the submitted
 * payload, and their children stay at the parent's scope. A `list` is the
 * opposite — it owns a name and nests its children under it.
 */
export const TRANSPARENT_CONTAINER_TYPES = ['group', 'card'] as const;

export function isContainerType(type: FieldType): boolean {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}

export function isPresentationalType(type: FieldType): boolean {
  return (PRESENTATIONAL_TYPES as readonly string[]).includes(type);
}

export function isTransparentContainer(type: FieldType): boolean {
  return (TRANSPARENT_CONTAINER_TYPES as readonly string[]).includes(type);
}

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
/* Conditional visibility                                                      */
/* -------------------------------------------------------------------------- */

export const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'in',
  'notIn',
  'gt',
  'lt',
  'contains',
  'empty',
  'notEmpty',
] as const;

export const conditionOperatorSchema = z.enum(CONDITION_OPERATORS);
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;

/** Operators that ignore `value` entirely — the editor hides the value input. */
export const UNARY_OPERATORS: ConditionOperator[] = ['empty', 'notEmpty'];

export const conditionSchema = z.object({
  /** Name of the field being tested. Resolved row-locally first, then at root. */
  field: z.string(),
  operator: conditionOperatorSchema,
  value: z.unknown().optional(),
});
export type Condition = z.infer<typeof conditionSchema>;

export const conditionGroupSchema = z.object({
  logic: z.enum(['and', 'or']),
  conditions: z.array(conditionSchema),
});
export type ConditionGroup = z.infer<typeof conditionGroupSchema>;

/* -------------------------------------------------------------------------- */
/* Field nodes                                                                 */
/* -------------------------------------------------------------------------- */

export const selectOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

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
 * Where a field's options come from when they are not authored inline.
 * Fetched by the browser at render time — see `src/renderer/remote/`.
 *
 * Deliberately GET-only, with no headers/auth/body field: everything here is
 * persisted to localStorage and included in exported JSON, so a token typed
 * into the inspector would leak into every share. Auth, if it is ever needed,
 * belongs on a runtime prop of `FormRenderer` — never in the schema.
 */
export const dataSourceSchema = z.object({
  // Literal + default: leaves room for a future discriminated union without
  // forcing hand-authored JSON to spell it out today.
  kind: z.literal('remote').default('remote'),
  /** http(s) URL. `{{fieldName}}` is replaced with a live form value. */
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

const fieldNodeBase = z.object({
  /** Builder identity and dnd key. Never part of submitted form data. */
  id: z.string(),
  type: fieldTypeSchema,
  /** Form.Item name segment. Ignored for presentational types. */
  name: z.string(),
  label: z.string().optional(),
  /** Grid width, 1..24. Drives <Col span>. */
  span: z.number().int().min(1).max(24).default(24),
  placeholder: z.string().optional(),
  tooltip: z.string().optional(),
  extra: z.string().optional(),
  defaultValue: z.unknown().optional(),
  disabled: z.boolean().default(false),
  /** Always hidden, regardless of `condition`. */
  hidden: z.boolean().default(false),
  rules: z.array(ruleSpecSchema).default([]),
  condition: conditionGroupSchema.optional(),
  options: z.array(selectOptionSchema).optional(),
  /** Remote option source. When present it supersedes `options` at render time. */
  dataSource: dataSourceSchema.optional(),
  /** Escape hatch for per-type antd control props (rows, step, mode, ...). */
  props: z.record(z.string(), z.unknown()).default({}),
  listConfig: listConfigSchema.optional(),
});

export type FieldNode = z.infer<typeof fieldNodeBase> & {
  children?: FieldNode[];
};

export const fieldNodeSchema: z.ZodType<FieldNode> = fieldNodeBase.extend({
  children: z.lazy(() => z.array(fieldNodeSchema)).optional(),
});

/* -------------------------------------------------------------------------- */
/* Root form schema                                                            */
/* -------------------------------------------------------------------------- */

export const SCHEMA_VERSION = 1;

export const formSchemaSchema = z.object({
  version: z.number().int().default(SCHEMA_VERSION),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: z.enum(['horizontal', 'vertical', 'inline']).default('vertical'),
  labelCol: z.object({ span: z.number().int().min(1).max(24) }).optional(),
  wrapperCol: z.object({ span: z.number().int().min(1).max(24) }).optional(),
  size: z.enum(['small', 'middle', 'large']).default('middle'),
  colon: z.boolean().default(true),
  gutter: z.number().int().nonnegative().default(16),
  submitText: z.string().default('Submit'),
  showReset: z.boolean().default(true),
  fields: z.array(fieldNodeSchema).default([]),
});

export type FormSchema = z.infer<typeof formSchemaSchema>;

export function createEmptySchema(): FormSchema {
  return formSchemaSchema.parse({ fields: [] });
}

export type ParseResult =
  | { ok: true; schema: FormSchema }
  | { ok: false; errors: string[] };

/** Validate unknown JSON against the contract. Never throws. */
export function parseFormSchema(input: unknown): ParseResult {
  const result = formSchemaSchema.safeParse(input);
  if (result.success) {
    return { ok: true, schema: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}
