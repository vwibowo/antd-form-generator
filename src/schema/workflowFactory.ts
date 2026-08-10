import { createId } from '@/lib/ids';
import { createEmptySchema } from './schema';
import type { WorkflowEdge, WorkflowNode, WorkflowNodeKind, WorkflowSchema } from './workflow';
import { workflowNodeSchema } from './workflow';
import { outgoingEdges } from './workflowGraph';
import { WORKFLOW_REGISTRY } from './workflowRegistry';

/** Lowest unused `${base}N` payload name across every node. */
export function uniqueWorkflowName(nodes: WorkflowNode[], base: string): string {
  const taken = new Set(nodes.map((node) => node.name).filter(Boolean));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/**
 * Build a new node of `kind` with registry defaults applied.
 *
 * A `form` node arrives with a parsed empty form rather than nothing, so the
 * builder never has to special-case "not authored yet"; the schema keeps
 * `form` optional so that hand-written JSON for the other kinds stays clean.
 */
export function createWorkflowNode(
  kind: WorkflowNodeKind,
  existing: WorkflowNode[] = [],
  at?: { x: number; y: number },
): WorkflowNode {
  const meta = WORKFLOW_REGISTRY[kind];

  return workflowNodeSchema.parse({
    id: createId('wf'),
    kind,
    x: at?.x ?? 48,
    y: at?.y ?? 48,
    ...meta.defaults,
    name: meta.supports.carriesName ? uniqueWorkflowName(existing, meta.namePrefix) : '',
    ...(meta.supports.holdsForm ? { form: createEmptySchema() } : {}),
    ...(kind === 'approval'
      ? {
          outcomes: [
            { id: 'approve', label: 'Approve' },
            { id: 'reject', label: 'Reject', danger: true },
          ],
        }
      : {}),
    ...(kind === 'action' ? { action: { id: '', label: meta.label } } : {}),
  });
}

/** Copy of a node with a fresh id, a free name and a small offset. */
export function duplicateWorkflowNode(node: WorkflowNode, existing: WorkflowNode[]): WorkflowNode {
  const clone = structuredClone(node);
  clone.id = createId('wf');
  clone.x += 32;
  clone.y += 32;
  if (clone.name) clone.name = uniqueWorkflowName(existing, node.name);
  return clone;
}

/**
 * A new branch between two nodes.
 *
 * `priority` lands after whatever is already there, so a freshly drawn edge is
 * tried last rather than silently jumping the queue.
 */
export function createWorkflowEdge(
  schema: WorkflowSchema,
  from: string,
  to: string,
): WorkflowEdge {
  return {
    id: createId('edge'),
    from,
    to,
    label: '',
    priority: outgoingEdges(schema, from).length,
    isDefault: false,
  };
}
