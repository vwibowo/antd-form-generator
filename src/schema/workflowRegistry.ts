import type { WorkflowNode, WorkflowNodeKind } from './workflow';

/**
 * Per-kind metadata driving the node palette, the canvas card and node
 * creation. The renderer does NOT read this — the engine switches on `kind`
 * directly, so it stays independent of builder concerns, exactly as
 * `registry.ts` does for fields.
 */

export interface WorkflowNodeSupports {
  /** Edges may end here. Only `start` says no. */
  inPort: boolean;
  /** Edges may leave here. Only `end` says no. */
  outPort: boolean;
  /** The node writes into the payload, so the inspector offers a `name`. */
  carriesName: boolean;
  /** The node holds an embedded screen. */
  holdsScreen: boolean;
}

export interface WorkflowNodeMeta {
  kind: WorkflowNodeKind;
  label: string;
  /** One line under the palette entry, and the empty-description fallback. */
  hint: string;
  /** Card accent. Plain hex rather than antd tokens — the SVG edges reuse these. */
  color: string;
  /** Base for auto-generated node names, e.g. `approval`, `approval2`. */
  namePrefix: string;
  supports: WorkflowNodeSupports;
  /** Seed values merged into a freshly created node. */
  defaults: Partial<WorkflowNode>;
}

const plain: WorkflowNodeSupports = {
  inPort: true,
  outPort: true,
  carriesName: false,
  holdsScreen: false,
};

export const WORKFLOW_REGISTRY: Record<WorkflowNodeKind, WorkflowNodeMeta> = {
  start: {
    kind: 'start',
    label: 'Start',
    hint: 'Where every run begins',
    color: '#52c41a',
    namePrefix: 'start',
    supports: { ...plain, inPort: false },
    defaults: { label: 'Start' },
  },
  screen: {
    kind: 'screen',
    label: 'Screen',
    hint: 'Asks, tells, or both — and offers a way onward',
    color: '#1677ff',
    namePrefix: 'step',
    // Carries a name because its buttons write to the payload, exactly as an
    // approval's outcomes do.
    supports: { ...plain, carriesName: true, holdsScreen: true },
    defaults: { label: 'Screen step' },
  },
  decision: {
    kind: 'decision',
    label: 'Decision',
    hint: 'Routes without asking anything',
    color: '#722ed1',
    namePrefix: 'decision',
    supports: plain,
    defaults: { label: 'Decision' },
  },
  action: {
    kind: 'action',
    label: 'Action',
    hint: 'Asks the host app to do something',
    color: '#fa8c16',
    namePrefix: 'action',
    supports: plain,
    defaults: { label: 'Action' },
  },
  approval: {
    kind: 'approval',
    label: 'Approval',
    hint: 'Waits for a decision, then branches on it',
    color: '#eb2f96',
    namePrefix: 'approval',
    supports: { ...plain, carriesName: true },
    defaults: { label: 'Approval' },
  },
  end: {
    kind: 'end',
    label: 'End',
    hint: 'The run finishes here',
    color: '#8c8c8c',
    namePrefix: 'end',
    supports: { ...plain, outPort: false },
    defaults: { label: 'End' },
  },
};

export function workflowMetaFor(kind: WorkflowNodeKind): WorkflowNodeMeta {
  return WORKFLOW_REGISTRY[kind];
}

/** What the canvas and the run trace call a node when it has no label. */
export function nodeCaption(node: WorkflowNode): string {
  return node.label || WORKFLOW_REGISTRY[node.kind].label;
}
