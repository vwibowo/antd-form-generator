import { z } from 'zod';
import { createId } from '@/lib/ids';
import { conditionGroupSchema, formSchemaSchema } from './schema';

/**
 * The workflow document — the JSON contract for "these steps, in this order,
 * with these branches".
 *
 * A sibling of `schema.ts` and `table.ts`, not an extension of either. Same
 * rules as those files: zod is the single source of truth, the TS types are
 * inferred from it, and `parseWorkflowSchema` never throws.
 *
 * Branching reuses `conditionGroupSchema` and the evaluator in
 * `src/renderer/condition.ts` rather than inventing an expression language —
 * someone who can write a field's visibility rule can write a branch, and
 * there is one set of operator semantics to learn and to maintain.
 */

export const WORKFLOW_NODE_KINDS = [
  'start',
  'form',
  'decision',
  'action',
  'approval',
  'end',
] as const;

export const workflowNodeKindSchema = z.enum(WORKFLOW_NODE_KINDS);
export type WorkflowNodeKind = z.infer<typeof workflowNodeKindSchema>;

/** Kinds that pause a run and wait for the person driving it. */
export const INTERACTIVE_NODE_KINDS = ['form', 'action', 'approval'] as const;
/** Kinds the engine passes straight through — they render nothing. */
export const PASSTHROUGH_NODE_KINDS = ['start', 'decision'] as const;

export function isInteractiveKind(kind: WorkflowNodeKind): boolean {
  return (INTERACTIVE_NODE_KINDS as readonly string[]).includes(kind);
}

export function isPassthroughKind(kind: WorkflowNodeKind): boolean {
  return (PASSTHROUGH_NODE_KINDS as readonly string[]).includes(kind);
}

/* -------------------------------------------------------------------------- */
/* Node payloads                                                               */
/* -------------------------------------------------------------------------- */

export const approvalOutcomeSchema = z.object({
  /** Stored in the payload under the node's `name` — this is what conditions test. */
  id: z.string(),
  label: z.string(),
  /** Renders the button in red. Presentation only; routing is the condition's job. */
  danger: z.boolean().default(false),
});
export type ApprovalOutcome = z.infer<typeof approvalOutcomeSchema>;

/**
 * What an `action` node asks the host to do.
 *
 * Intent only — an id, a label and static arguments — for the same reason
 * `tableActionSchema` is: the document says what should happen, and the app
 * embedding the workflow decides how. The preview simulates it with a button.
 */
export const nodeActionSchema = z.object({
  id: z.string().default(''),
  label: z.string().default(''),
  params: z.record(z.string(), z.string()).default({}),
});
export type NodeAction = z.infer<typeof nodeActionSchema>;

/* -------------------------------------------------------------------------- */
/* Nodes                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One flat node with optional per-kind payloads, mirroring `FieldNode` rather
 * than the discriminated union `ruleSpecSchema` uses.
 *
 * `updateNode(id, patch)` + `Object.assign` is the store idiom, and a
 * `Partial<>` of a discriminated union distributes into something
 * `Object.assign` cannot accept; changing a node's kind stays a one-key patch;
 * and zod reports a bad discriminator at the top level, where the JSON tab
 * needs `nodes.2.form.fields.0.type`. An `end` node carrying an inert
 * `outcomes` is the same harmlessness as `options` on a `divider` — the graph
 * validator mentions it, nothing breaks.
 */
export const workflowNodeSchema = z.object({
  /** Builder identity, dnd key, and what edges point at. */
  id: z.string(),
  kind: workflowNodeKindSchema,
  /** Blank means "use the kind's own name", so the canvas always has a caption. */
  label: z.string().default(''),
  description: z.string().default(''),
  /**
   * Payload key this node writes under. Used by `approval`, which stores the
   * chosen outcome id there; ignored by every other kind, the way
   * `FieldNode.name` is ignored for presentational types.
   */
  name: z.string().default(''),

  /** Canvas position in stage pixels. The builder snaps both to its grid. */
  x: z.number().default(0),
  y: z.number().default(0),

  /** `form` — a whole embeddable form, edited by the ordinary form builder. */
  form: formSchemaSchema.optional(),
  /** `approval` — the choices offered. One with none cannot be answered. */
  outcomes: z.array(approvalOutcomeSchema).optional(),
  /** `action` — what the host is being asked to do. */
  action: nodeActionSchema.optional(),

  /** Escape hatch, the same free-form bag as a field's `props`. */
  props: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

/* -------------------------------------------------------------------------- */
/* Edges                                                                       */
/* -------------------------------------------------------------------------- */

export const workflowEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  /** Canvas chip text. Blank falls back to a summary of the condition. */
  label: z.string().default(''),
  /**
   * Lower runs first. Ordering lives on the edge rather than in array position
   * so a JSON edit can reorder branches without moving objects around, and so
   * the builder can renumber one edge without rewriting its siblings.
   */
  priority: z.number().int().default(0),
  /**
   * The fallback. A default edge sits out the ordered scan entirely and is
   * taken only once nothing else matched, so this beats any priority.
   */
  isDefault: z.boolean().default(false),
  /**
   * Evaluated against the accumulated payload. Absent or empty always matches
   * — which, on a non-default edge, makes every later edge unreachable. That
   * is legal, and `validateWorkflow` says so.
   */
  condition: conditionGroupSchema.optional(),
});
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

/* -------------------------------------------------------------------------- */
/* Root workflow schema                                                        */
/* -------------------------------------------------------------------------- */

export const WORKFLOW_SCHEMA_VERSION = 1;

export const workflowSchemaSchema = z.object({
  version: z.number().int().default(WORKFLOW_SCHEMA_VERSION),
  /** Discriminator so an import can tell the three documents apart. */
  kind: z.literal('workflow').default('workflow'),
  title: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
  /**
   * How branches are drawn — smooth curves or right-angle elbows.
   *
   * Presentation only: the engine never reads it, and it changes no route, only
   * how the same corners are stroked.
   */
  edgeStyle: z.enum(['curve', 'step']).default('curve'),
  props: z.record(z.string(), z.unknown()).default({}),
});

export type WorkflowSchema = z.infer<typeof workflowSchemaSchema>;

/**
 * A new workflow, which is not the same as an empty one.
 *
 * The zod defaults above stay `[]` on purpose — that is what a minimal
 * hand-authored document means, and the validator is what tells its author it
 * cannot run yet. What New and Clear hand over is different: a graph with no
 * `start` is invalid by definition, so this seeds a runnable pair rather than
 * opening a blank canvas with an error already showing.
 */
export function createEmptyWorkflowSchema(): WorkflowSchema {
  const start = createId('wf');
  const end = createId('wf');
  return workflowSchemaSchema.parse({
    // Side by side, not stacked: branches leave a card on the right and arrive
    // on the left, so a node placed below its predecessor draws a curve that
    // doubles back on itself.
    nodes: [
      { id: start, kind: 'start', label: 'Start', x: 48, y: 48 },
      { id: end, kind: 'end', label: 'Done', x: 384, y: 48 },
    ],
    edges: [{ id: createId('edge'), from: start, to: end }],
  });
}

export type WorkflowParseResult =
  | { ok: true; schema: WorkflowSchema }
  | { ok: false; errors: string[] };

/** Validate unknown JSON against the contract. Never throws. */
export function parseWorkflowSchema(input: unknown): WorkflowParseResult {
  const result = workflowSchemaSchema.safeParse(input);
  if (result.success) return { ok: true, schema: result.data };
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { ok: false, errors };
}
