import { z } from 'zod';

/**
 * What every node in a document has in common, and the condition language they
 * all share.
 *
 * A screen's nodes and a workflow's edges both reach for `ConditionGroup`, so
 * one definition here means a change to `span`'s bounds or to an operator
 * cannot apply to one document kind and not the other. The five-key core was
 * what first showed that a form field and a page block were the same type — see
 * `screen.ts`.
 *
 * This file sits below `screen.ts` and `workflow.ts` in the import graph and
 * depends on neither, so neither has to import the other. `screen.ts` re-exports
 * the condition types, which is where callers reach for them.
 */

/* -------------------------------------------------------------------------- */
/* Conditions                                                                  */
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
/* Node base                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The keys a node has whatever it turns out to be. Extended with a `type` and
 * the per-type payload keys by whoever uses it.
 *
 * Deliberately no `type`: a field's type enum and a block's are different sets,
 * and narrowing that here would mean one of them extending a base it does not
 * satisfy.
 */
export const nodeBaseSchema = z.object({
  /** Builder identity and dnd key. Never part of submitted form data. */
  id: z.string(),
  /** Grid width, 1..24. Drives `<Col span>`. */
  span: z.number().int().min(1).max(24).default(24),
  /** Always hidden, regardless of `condition`. */
  hidden: z.boolean().default(false),
  /** Show only when this matches, evaluated against the surrounding payload. */
  condition: conditionGroupSchema.optional(),
  /** Escape hatch for per-type props the contract does not name. */
  props: z.record(z.string(), z.unknown()).default({}),
});
export type NodeBase = z.infer<typeof nodeBaseSchema>;
