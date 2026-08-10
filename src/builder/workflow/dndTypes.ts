import type { WorkflowNodeKind } from '@/schema/workflow';

/**
 * Drag payloads for the graph canvas.
 *
 * A separate union from `src/builder/dndTypes.ts`: the two builders are never
 * mounted at the same time, but keeping the `source` strings distinct means a
 * mistake shows up as a type error rather than as a field being dropped into a
 * workflow.
 */

/** A node kind being dragged out of the left-hand palette. */
export interface NodePaletteDragData {
  source: 'wf-palette';
  kind: WorkflowNodeKind;
}

/** An existing node being repositioned. */
export interface NodeMoveDragData {
  source: 'wf-node';
  id: string;
}

/** A node's output port being pulled out to draw a branch. */
export interface PortDragData {
  source: 'wf-port';
  from: string;
}

/** The droppable half of a node card — where a branch can land. */
export interface NodeDropData {
  source: 'wf-node-drop';
  id: string;
}

/** The canvas itself, so a palette drop knows where it was released. */
export interface StageDropData {
  source: 'wf-stage';
}

export type WorkflowDragData =
  | NodePaletteDragData
  | NodeMoveDragData
  | PortDragData
  | NodeDropData
  | StageDropData;

/**
 * What is being dragged right now, and how far it has travelled in stage
 * pixels.
 *
 * The store is not written until the drop, so this is the only thing that knows
 * a node has moved while the gesture is still in flight. The edge layer offsets
 * its endpoints by it, which is what makes a branch follow its card; the
 * rubber band reads the same value. `null` means nothing is being dragged.
 */
export interface ActiveDrag {
  kind: 'node' | 'port';
  /** The node being moved, or the node the branch is being pulled out of. */
  id: string;
  dx: number;
  dy: number;
}

export const WF_PALETTE_ID_PREFIX = 'wf-palette:';
export const WF_PORT_ID_PREFIX = 'wf-port:';
export const WF_DROP_ID_PREFIX = 'wf-drop:';
export const WF_STAGE_ID = 'wf-stage';

export function nodePaletteDraggableId(kind: WorkflowNodeKind): string {
  return `${WF_PALETTE_ID_PREFIX}${kind}`;
}

export function portDraggableId(nodeId: string): string {
  return `${WF_PORT_ID_PREFIX}${nodeId}`;
}

export function nodeDroppableId(nodeId: string): string {
  return `${WF_DROP_ID_PREFIX}${nodeId}`;
}
