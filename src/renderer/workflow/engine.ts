import type { WorkflowEdge, WorkflowSchema } from '@/schema/workflow';
import { isPassthroughKind } from '@/schema/workflow';
import {
  defaultOutgoing,
  findStartNodes,
  findWorkflowNode,
  orderedOutgoing,
} from '@/schema/workflowGraph';
import { evaluateCondition } from '../condition';

/**
 * Running a workflow: which node is current, and which branch is taken next.
 *
 * Pure and free of React, like the rest of `src/renderer/` — the preview drives
 * it, but so could anything else. Branch conditions go through the very same
 * `evaluateCondition` a form field's visibility uses, so there is one set of
 * operator semantics in the product rather than two.
 *
 * ## Values
 *
 * One flat accumulated payload. Each completed form node contributes its whole
 * submitted object, merged over what came before, and an approval contributes
 * `{ [node.name]: outcomeId }`. Conditions therefore name fields exactly as
 * they do inside a form.
 *
 * Not namespaced per node, because a condition's `field` is resolved as a
 * single path segment (see `resolveConditionValue`) — `claimDetails.amount`
 * would not resolve without changing shared runtime code. The cost is that two
 * form nodes declaring `amount` collide and the later one wins;
 * `validateWorkflow` reports that, in the same spirit as duplicate field names
 * inside one form.
 *
 * ## Choosing a branch
 *
 * Conditional edges are tried in `priority` order and the first match wins. If
 * none matched, the node's `isDefault` edge is taken. If there is no default
 * either, the run stops in `blocked` rather than sitting on the current node —
 * staying put is indistinguishable from a hang, and there is nothing the person
 * driving could do to move it along.
 */

export type WorkflowRunStatus = 'running' | 'done' | 'blocked';

export type WorkflowBlockReason =
  /** The graph has no `start` node. */
  | 'no-start'
  /** No conditional branch matched and there is no fallback. */
  | 'no-match'
  /** An edge points at a node that is not in the document. */
  | 'missing-target'
  /** The current node id is not in the document. */
  | 'missing-node'
  /** Pass-through nodes chained into each other without ever settling. */
  | 'loop';

export interface WorkflowRunState {
  status: WorkflowRunStatus;
  /** The node waiting for input, the `end` that finished the run, or where it stuck. */
  nodeId: string | null;
  /** Everything contributed so far, merged flat. */
  values: Record<string, unknown>;
  /** Node ids in visit order, pass-through nodes included. */
  trace: string[];
  /** Edge ids taken, in order — `taken[i]` is the edge leaving `trace[i]`. */
  taken: string[];
  blocked: { reason: WorkflowBlockReason; nodeId: string | null } | null;
}

/**
 * A run only advances when a person answers something, so an unbroken chain of
 * pass-through nodes this long can only be a cycle feeding itself.
 */
const MAX_AUTO_STEPS = 50;

/** The branch a run leaves `nodeId` by, or null when nothing matches. */
export function chooseEdge(
  schema: WorkflowSchema,
  nodeId: string,
  values: Record<string, unknown>,
): WorkflowEdge | null {
  for (const edge of orderedOutgoing(schema, nodeId)) {
    if (evaluateCondition(edge.condition, values)) return edge;
  }
  return defaultOutgoing(schema, nodeId);
}

function block(
  state: WorkflowRunState,
  reason: WorkflowBlockReason,
  nodeId: string | null,
): WorkflowRunState {
  return { ...state, status: 'blocked', nodeId, blocked: { reason, nodeId } };
}

/**
 * Move forward from the current node until the run reaches something a person
 * has to answer, an `end`, or a wall.
 *
 * `start` and `decision` render nothing, so stopping on one would show an empty
 * screen; they are followed through here instead.
 */
function settle(schema: WorkflowSchema, state: WorkflowRunState): WorkflowRunState {
  let current = state;

  for (let step = 0; step < MAX_AUTO_STEPS; step += 1) {
    if (current.nodeId === null) return block(current, 'missing-node', null);

    const node = findWorkflowNode(schema, current.nodeId);
    if (!node) return block(current, 'missing-node', current.nodeId);

    if (node.kind === 'end') return { ...current, status: 'done' };
    if (!isPassthroughKind(node.kind)) return { ...current, status: 'running' };

    const edge = chooseEdge(schema, node.id, current.values);
    if (!edge) return block(current, 'no-match', node.id);
    if (!findWorkflowNode(schema, edge.to)) return block(current, 'missing-target', node.id);

    current = {
      ...current,
      nodeId: edge.to,
      trace: [...current.trace, edge.to],
      taken: [...current.taken, edge.id],
    };
  }

  return block(current, 'loop', current.nodeId);
}

/** Begin a run at the graph's start node. `seed` pre-fills the payload. */
export function startWorkflow(
  schema: WorkflowSchema,
  seed: Record<string, unknown> = {},
): WorkflowRunState {
  const empty: WorkflowRunState = {
    status: 'running',
    nodeId: null,
    values: { ...seed },
    trace: [],
    taken: [],
    blocked: null,
  };

  const [start] = findStartNodes(schema);
  if (!start) return block(empty, 'no-start', null);

  return settle(schema, { ...empty, nodeId: start.id, trace: [start.id] });
}

/**
 * Merge what the current node produced, take its branch, and settle on the next
 * thing that needs a person.
 *
 * Pure: returns a new state and never mutates the one handed in, which is what
 * lets the preview keep every step for a Back button.
 */
export function advanceWorkflow(
  schema: WorkflowSchema,
  state: WorkflowRunState,
  contribution: Record<string, unknown> = {},
): WorkflowRunState {
  // A finished or stuck run has nowhere to go; returning it unchanged keeps
  // callers from having to guard every button.
  if (state.status !== 'running' || state.nodeId === null) return state;

  const values = { ...state.values, ...contribution };
  const node = findWorkflowNode(schema, state.nodeId);
  if (!node) return block({ ...state, values }, 'missing-node', state.nodeId);

  const edge = chooseEdge(schema, node.id, values);
  if (!edge) return block({ ...state, values }, 'no-match', node.id);
  if (!findWorkflowNode(schema, edge.to)) {
    return block({ ...state, values }, 'missing-target', node.id);
  }

  return settle(schema, {
    ...state,
    values,
    nodeId: edge.to,
    trace: [...state.trace, edge.to],
    taken: [...state.taken, edge.id],
  });
}

/** Prose for a blocked run — the preview shows this verbatim. */
export function describeBlock(reason: WorkflowBlockReason): string {
  switch (reason) {
    case 'no-start':
      return 'This workflow has no start node, so a run has nowhere to begin.';
    case 'no-match':
      return 'No branch condition matched here, and this step has no fallback branch.';
    case 'missing-target':
      return 'The branch taken here points at a node that is no longer in the document.';
    case 'missing-node':
      return 'The step this run was on is no longer in the document.';
    case 'loop':
      return 'The run kept moving between steps that ask nothing, so it was stopped.';
    default:
      return 'The run stopped here.';
  }
}
