import type { ScreenNode } from './screen';
import { collectScreenActions, collectsValue, hasNoWayOnward, isContainerType } from './screen';
import type { WorkflowEdge, WorkflowNode, WorkflowSchema } from './workflow';
import { isInteractiveKind } from './workflow';
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
 * Top-level keys one embedded screen contributes to the run payload.
 *
 * This mirrors `collectPayloadKeys` in `src/renderer/initialValues.ts` rather
 * than importing it, so `src/schema/` never reaches into the renderer. If the
 * payload rules change, both sides change — there is a matching note over there.
 */
function screenNames(nodes: ScreenNode[], out: { name: string; label: string }[]): void {
  for (const node of nodes) {
    if (!collectsValue(node.type)) {
      // A transparent container keeps its children at this scope; a display
      // node has no children to look through.
      if (isContainerType(node.type)) screenNames(node.children ?? [], out);
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

    // One screen contributes twice over: the keys its controls collect, and —
    // when it has buttons — the key those buttons write their outcome to. That
    // took two node kinds before the merge.
    if (node.kind === 'screen' && node.screen) {
      screenNames(node.screen.nodes, contributed);
      if (node.name && collectScreenActions(node.screen).length > 0) {
        contributed.push({ name: node.name, label: `${nodeCaption(node)} button` });
      }
    }
    if (node.kind === 'approval' && node.name) {
      contributed.push({ name: node.name, label: `${nodeCaption(node)} decision` });
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
/* Layering                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Edges that close a loop, found by depth-first search.
 *
 * Cycles are a feature here — "finance wants more detail, go back to the form"
 * is the whole point — but a layered layout needs a DAG. These are dropped for
 * layering only; the routing still draws them.
 */
export function findBackEdges(schema: WorkflowSchema, roots: string[]): Set<string> {
  const back = new Set<string>();
  const state = new Map<string, 'open' | 'done'>();
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of schema.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }

  // Iterative rather than recursive: a long chain would otherwise be one deep
  // call stack per node.
  const visit = (start: string) => {
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    state.set(start, 'open');

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const edges = outgoing.get(frame.id) ?? [];

      if (frame.next >= edges.length) {
        state.set(frame.id, 'done');
        stack.pop();
        continue;
      }

      const edge = edges[frame.next];
      frame.next += 1;

      // Pointing at something still open means we have looped back onto our
      // own path — that is exactly what a back-edge is.
      if (state.get(edge.to) === 'open') {
        back.add(edge.id);
        continue;
      }
      if (state.get(edge.to) === 'done') continue;

      state.set(edge.to, 'open');
      stack.push({ id: edge.to, next: 0 });
    }
  };

  for (const root of roots) if (!state.has(root)) visit(root);
  // Anything the start could not reach still needs its own cycles broken.
  for (const node of schema.nodes) if (!state.has(node.id)) visit(node.id);

  return back;
}

/**
 * Longest-path columns over the DAG: a node sits one past its furthest
 * predecessor. Using the longest path rather than the shortest is what keeps a
 * step to the right of everything that can reach it, so no branch ever points
 * backwards except a real loop.
 */
export function assignColumns(
  schema: WorkflowSchema,
  forward: WorkflowEdge[],
  reachable: Set<string>,
): Map<string, number> {
  const columns = new Map<string, number>();
  const incoming = new Map<string, WorkflowEdge[]>();
  const outgoing = new Map<string, WorkflowEdge[]>();
  for (const edge of forward) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }

  const pending = new Map<string, number>();
  const queue: string[] = [];
  for (const node of schema.nodes) {
    if (!reachable.has(node.id)) continue;
    const count = (incoming.get(node.id) ?? []).length;
    pending.set(node.id, count);
    if (count === 0) {
      columns.set(node.id, 0);
      queue.push(node.id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const column = columns.get(id) ?? 0;
    for (const edge of outgoing.get(id) ?? []) {
      columns.set(edge.to, Math.max(columns.get(edge.to) ?? 0, column + 1));
      const left = (pending.get(edge.to) ?? 1) - 1;
      pending.set(edge.to, left);
      if (left === 0) queue.push(edge.to);
    }
  }

  // A node left unranked sat inside a knot the back-edge pass could not fully
  // open; park it one past its deepest ranked predecessor rather than at zero.
  for (const node of schema.nodes) {
    if (!reachable.has(node.id) || columns.has(node.id)) continue;
    const preds = (incoming.get(node.id) ?? [])
      .map((edge) => columns.get(edge.from))
      .filter((value): value is number => value !== undefined);
    columns.set(node.id, preds.length > 0 ? Math.max(...preds) + 1 : 0);
  }

  return columns;
}

/** One stage of a run: the steps that sit at the same depth from the start. */
export interface WorkflowStage {
  /** 0-based depth. Two steps on parallel branches share one. */
  index: number;
  nodeIds: string[];
  /** What to call the stage — the single step's caption, or a count. */
  label: string;
}

/**
 * The steps a run passes through, in order, for a progress indicator.
 *
 * Only the kinds that stop and ask: `start` and `decision` pass straight
 * through and would show as stages nobody experiences. Parallel branches
 * collapse into one stage, because from the reader's side "step 3 of 5" counts
 * how far along they are, not how many routes the graph has.
 *
 * `findBackEdges` has already broken the loops, so a run that goes back reads
 * as an earlier stage again rather than pushing the total past the end.
 */
export function workflowStages(schema: WorkflowSchema): WorkflowStage[] {
  const starts = findStartNodes(schema).map((node) => node.id);
  const back = findBackEdges(schema, starts);
  const forward = schema.edges.filter((edge) => !back.has(edge.id) && edge.from !== edge.to);
  const ranked = new Set(schema.nodes.map((node) => node.id));
  const columnOf = assignColumns(schema, forward, ranked);

  const byColumn = new Map<number, WorkflowNode[]>();
  for (const node of schema.nodes) {
    // The kinds that stop and ask, plus `end` — finishing is something the
    // reader experiences, so it earns a stage.
    if (!isInteractiveKind(node.kind) && node.kind !== 'end') continue;
    const column = columnOf.get(node.id) ?? 0;
    byColumn.set(column, [...(byColumn.get(column) ?? []), node]);
  }

  return [...byColumn.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, nodes], index) => ({
      index,
      nodeIds: nodes.map((node) => node.id),
      label: nodes.length === 1 ? nodeCaption(nodes[0]) : `${nodes.length} ways on`,
    }));
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
  | 'empty-screen'
  | 'no-outcomes'
  | 'no-way-onward'
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

    if (node.kind === 'screen') {
      if ((node.screen?.nodes.length ?? 0) === 0) {
        issues.push({
          level: 'warning',
          code: 'empty-screen',
          message: `"${caption}" is empty, so it neither asks nor tells the reader anything.`,
          nodeId: node.id,
        });
      } else if (node.screen && hasNoWayOnward(node.screen)) {
        // Nothing to submit and no button to press, so a run reaching it cannot
        // continue even though the edge leaving it exists.
        issues.push({
          level: 'warning',
          code: 'no-way-onward',
          message: `"${caption}" has no fields and no buttons, so a run reaching it cannot continue.`,
          nodeId: node.id,
        });
      }
    }

    if (node.kind === 'approval' && (node.outcomes?.length ?? 0) === 0) {
      issues.push({
        level: 'warning',
        code: 'no-outcomes',
        message: `"${caption}" offers no outcomes, so it cannot be answered.`,
        nodeId: node.id,
      });
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
  // the later one wins. Warned, not prevented, exactly like duplicate names
  // inside a single screen.
  const owners = new Map<string, string[]>();
  for (const node of schema.nodes) {
    const contributed: string[] = [];
    if (node.kind === 'screen' && node.screen) {
      const names: { name: string; label: string }[] = [];
      screenNames(node.screen.nodes, names);
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
