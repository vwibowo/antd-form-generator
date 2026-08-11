import { hasNoWayOnward } from './page';
import type { FieldNode } from './schema';
import { isPresentationalType, isTransparentContainer } from './schema';
import type { WorkflowEdge, WorkflowNode, WorkflowSchema } from './workflow';
import { nodeCaption, workflowMetaFor } from './workflowRegistry';

/**
 * Graph queries and problem detection — the `walk.ts` of workflows.
 *
 * Pure, and free of React and of any store. `src/renderer/workflow/engine.ts`
 * imports it for edge ordering, and the builder imports it for the problem
 * list, so the two can never disagree about what "the next edge" means.
 */

export function findWorkflowNode(schema: WorkflowSchema, id: string): WorkflowNode | null {
  return schema.nodes.find((node) => node.id === id) ?? null;
}

export function outgoingEdges(schema: WorkflowSchema, nodeId: string): WorkflowEdge[] {
  return schema.edges.filter((edge) => edge.from === nodeId);
}

export function incomingEdges(schema: WorkflowSchema, nodeId: string): WorkflowEdge[] {
  return schema.edges.filter((edge) => edge.to === nodeId);
}

/**
 * The conditional branches out of a node, in the order the engine tries them:
 * lowest `priority` first, document order breaking ties.
 */
export function orderedOutgoing(schema: WorkflowSchema, nodeId: string): WorkflowEdge[] {
  return outgoingEdges(schema, nodeId)
    .filter((edge) => !edge.isDefault)
    .map((edge, index) => ({ edge, index }))
    .sort((a, b) => a.edge.priority - b.edge.priority || a.index - b.index)
    .map((entry) => entry.edge);
}

/** The fallback out of a node. More than one is a validation warning. */
export function defaultOutgoing(schema: WorkflowSchema, nodeId: string): WorkflowEdge | null {
  return outgoingEdges(schema, nodeId).find((edge) => edge.isDefault) ?? null;
}

export function findStartNodes(schema: WorkflowSchema): WorkflowNode[] {
  return schema.nodes.filter((node) => node.kind === 'start');
}

/** Node ids reachable from `startId` by following edges, conditions ignored. */
export function reachableFrom(schema: WorkflowSchema, startId: string): Set<string> {
  const seen = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of outgoingEdges(schema, id)) queue.push(edge.to);
  }
  return seen;
}

/**
 * Reachability memo for one validation pass.
 *
 * `participatesInCycle` asks the same question once per outgoing edge, so
 * without this a single `validateWorkflow` runs a fresh traversal per edge —
 * fine at a dozen nodes, quadratic by the time a graph is interesting.
 */
type ReachabilityCache = Map<string, Set<string>>;

function reachableCached(
  schema: WorkflowSchema,
  startId: string,
  cache: ReachabilityCache,
): Set<string> {
  const hit = cache.get(startId);
  if (hit) return hit;
  const computed = reachableFrom(schema, startId);
  cache.set(startId, computed);
  return computed;
}

/** True when any edge path leads from `nodeId` back to itself. */
function participatesInCycle(
  schema: WorkflowSchema,
  nodeId: string,
  cache: ReachabilityCache,
): boolean {
  for (const edge of outgoingEdges(schema, nodeId)) {
    if (reachableCached(schema, edge.to, cache).has(nodeId)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Payload keys                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Top-level keys one embedded form contributes to the run payload.
 *
 * This mirrors `collectPayloadKeys` in `src/renderer/initialValues.ts` rather
 * than importing it, so `src/schema/` never reaches into the renderer. If the
 * form's payload rules change, both sides change — there is a matching note
 * over there.
 */
function formNames(fields: FieldNode[], out: { name: string; label: string }[]): void {
  for (const node of fields) {
    if (isPresentationalType(node.type)) continue;
    if (isTransparentContainer(node.type)) {
      formNames(node.children ?? [], out);
      continue;
    }
    out.push({ name: node.name, label: node.label || node.name });
  }
}

/**
 * Every payload key a branch condition can address, with a label for the
 * picker.
 *
 * Top level only: `resolveConditionValue` resolves a condition's `field` as a
 * single path segment, so a field inside a repeatable row is not addressable
 * from a branch and must not be offered as if it were.
 */
export function collectWorkflowNames(
  schema: WorkflowSchema,
): { name: string; label: string; nodeId: string }[] {
  const out: { name: string; label: string; nodeId: string }[] = [];
  const seen = new Set<string>();

  for (const node of schema.nodes) {
    const contributed: { name: string; label: string }[] = [];

    if (node.kind === 'form' && node.form) {
      formNames(node.form.fields, contributed);
    }
    if (node.kind === 'approval' && node.name) {
      contributed.push({ name: node.name, label: `${nodeCaption(node)} decision` });
    }
    // A page's buttons are outcomes, so its key is branchable in exactly the
    // way an approval's is.
    if (node.kind === 'page' && node.name) {
      contributed.push({ name: node.name, label: `${nodeCaption(node)} button` });
    }

    for (const entry of contributed) {
      if (entry.name === '' || seen.has(entry.name)) continue;
      seen.add(entry.name);
      out.push({ ...entry, nodeId: node.id });
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export type WorkflowIssueCode =
  | 'no-start'
  | 'multiple-start'
  | 'no-end'
  | 'dead-end'
  | 'unreachable'
  | 'dangling-edge'
  | 'shadowed-edge'
  | 'no-default'
  | 'multiple-default'
  | 'duplicate-name'
  | 'empty-form'
  | 'no-outcomes'
  | 'empty-page'
  | 'no-page-actions'
  | 'cycle';

export interface WorkflowIssue {
  level: 'error' | 'warning';
  /** Stable code, so a UI can group or suppress without matching on prose. */
  code: WorkflowIssueCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/**
 * Everything wrong with the graph, as advice rather than a verdict.
 *
 * Never blocks a parse or an import — the same contract `findDuplicateNames`
 * has. A document being edited is allowed to be broken on the way to being
 * right, and the preview reports at run time what it actually hits.
 */
export function validateWorkflow(schema: WorkflowSchema): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const ids = new Set(schema.nodes.map((node) => node.id));
  // Lives for this call only — the schema cannot change underneath it.
  const reachability: ReachabilityCache = new Map();

  const starts = findStartNodes(schema);
  if (starts.length === 0) {
    issues.push({ level: 'error', code: 'no-start', message: 'No start node — a run has nowhere to begin.' });
  } else if (starts.length > 1) {
    for (const extra of starts.slice(1)) {
      issues.push({
        level: 'error',
        code: 'multiple-start',
        message: `More than one start node. A run always begins at "${nodeCaption(starts[0])}".`,
        nodeId: extra.id,
      });
    }
  }

  if (!schema.nodes.some((node) => node.kind === 'end')) {
    issues.push({
      level: 'warning',
      code: 'no-end',
      message: 'No end node — a run can only ever stop at a dead end.',
    });
  }

  for (const edge of schema.edges) {
    const missing = !ids.has(edge.from) ? edge.from : !ids.has(edge.to) ? edge.to : null;
    if (missing !== null) {
      issues.push({
        level: 'error',
        code: 'dangling-edge',
        message: `Branch points at a node that no longer exists (${missing}).`,
        edgeId: edge.id,
      });
    }
  }

  const reachable =
    starts.length > 0 ? reachableCached(schema, starts[0].id, reachability) : new Set<string>();

  for (const node of schema.nodes) {
    const meta = workflowMetaFor(node.kind);
    const caption = nodeCaption(node);
    const out = outgoingEdges(schema, node.id);

    if (meta.supports.outPort && out.length === 0) {
      issues.push({
        level: 'error',
        code: 'dead-end',
        message: `"${caption}" has no outgoing branch, so a run reaching it stops there.`,
        nodeId: node.id,
      });
    }

    if (starts.length > 0 && !reachable.has(node.id)) {
      issues.push({
        level: 'warning',
        code: 'unreachable',
        message: `"${caption}" cannot be reached from the start node.`,
        nodeId: node.id,
      });
    }

    if (node.kind === 'form' && (node.form?.fields.length ?? 0) === 0) {
      issues.push({
        level: 'warning',
        code: 'empty-form',
        message: `"${caption}" has no fields, so it collects nothing to branch on.`,
        nodeId: node.id,
      });
    }

    if (node.kind === 'approval' && (node.outcomes?.length ?? 0) === 0) {
      issues.push({
        level: 'warning',
        code: 'no-outcomes',
        message: `"${caption}" offers no outcomes, so it cannot be answered.`,
        nodeId: node.id,
      });
    }

    if (node.kind === 'page') {
      if ((node.page?.blocks.length ?? 0) === 0) {
        issues.push({
          level: 'warning',
          code: 'empty-page',
          message: `"${caption}" has no blocks, so it shows the reader nothing.`,
          nodeId: node.id,
        });
      } else if (node.page && hasNoWayOnward(node.page)) {
        // A page with no buttons cannot be advanced past, so anything after it
        // is unreachable in practice even though the edge exists.
        issues.push({
          level: 'warning',
          code: 'no-page-actions',
          message: `"${caption}" has no buttons, so a run reaching it cannot continue.`,
          nodeId: node.id,
        });
      }
    }

    const defaults = out.filter((edge) => edge.isDefault);
    for (const extra of defaults.slice(1)) {
      issues.push({
        level: 'warning',
        code: 'multiple-default',
        message: `"${caption}" has more than one fallback branch. Only the first is ever taken.`,
        edgeId: extra.id,
      });
    }

    const ordered = orderedOutgoing(schema, node.id);
    if (ordered.length > 1 && defaults.length === 0) {
      issues.push({
        level: 'warning',
        code: 'no-default',
        message: `"${caption}" has no fallback branch — a run stops here when no condition matches.`,
        nodeId: node.id,
      });
    }

    // An unconditional branch always matches, so anything queued behind it can
    // never be reached. Legal, and almost never what the author meant.
    ordered.forEach((edge, index) => {
      const unconditional = !edge.condition || edge.condition.conditions.length === 0;
      if (unconditional && index < ordered.length - 1) {
        issues.push({
          level: 'warning',
          code: 'shadowed-edge',
          message: `This branch out of "${caption}" has no condition, so the branches after it are never tried.`,
          edgeId: edge.id,
        });
      }
    });

    if (participatesInCycle(schema, node.id, reachability)) {
      issues.push({
        level: 'warning',
        code: 'cycle',
        message: `A run can return to "${caption}" — this step may be visited more than once.`,
        nodeId: node.id,
      });
    }
  }

  // The run payload is one flat object, so two nodes writing the same key means
  // the later one wins. Warned, not prevented, exactly like duplicate field
  // names inside a single form.
  const owners = new Map<string, string[]>();
  for (const node of schema.nodes) {
    const contributed: string[] = [];
    if (node.kind === 'form' && node.form) {
      const names: { name: string; label: string }[] = [];
      formNames(node.form.fields, names);
      contributed.push(...names.map((entry) => entry.name));
    }
    if (node.kind === 'approval' && node.name) contributed.push(node.name);
    for (const name of new Set(contributed)) {
      owners.set(name, [...(owners.get(name) ?? []), node.id]);
    }
  }
  for (const [name, nodeIds] of owners) {
    if (nodeIds.length < 2) continue;
    for (const nodeId of nodeIds.slice(1)) {
      const first = findWorkflowNode(schema, nodeIds[0]);
      issues.push({
        level: 'warning',
        code: 'duplicate-name',
        message: `"${name}" is also written by "${first ? nodeCaption(first) : nodeIds[0]}". The later value wins.`,
        nodeId,
      });
    }
  }

  return issues;
}
