import { memo } from 'react';
import type { WorkflowNode } from '@/schema/workflow';
import type { ActiveDrag } from './dndTypes';
import { outPort, pathFromWaypoints } from './edgeGeometry';

export interface PendingEdgeProps {
  nodes: Map<string, WorkflowNode>;
  /** Renders only for a `port` drag; a node move draws nothing here. */
  drag: ActiveDrag | null;
  width: number;
  height: number;
}

/**
 * The rubber band drawn while a branch is being pulled out of a port.
 *
 * Its own layer and its own component on purpose: this changes on every frame
 * of the drag, and keeping it separate means the committed edges underneath are
 * not re-rendered when only the loose end has moved.
 */
function PendingEdgeImpl({ nodes, drag, width, height }: PendingEdgeProps) {
  if (!drag || drag.kind !== 'port') return null;

  const from = nodes.get(drag.id);
  if (!from) return null;

  const start = outPort(from);
  const end = { x: start.x + drag.dx, y: start.y + drag.dy };

  return (
    <svg className="fg-wf-edges fg-wf-edges--pending" width={width} height={height} aria-hidden>
      {/* Always curved: the rubber band follows a cursor, not a route, so
          elbows would just make it twitch. */}
      <path className="fg-wf-edge fg-wf-edge--pending" d={pathFromWaypoints([start, end], 'curve')} />
      <circle className="fg-wf-edge-tip" cx={end.x} cy={end.y} r={4} />
    </svg>
  );
}

export const PendingEdge = memo(PendingEdgeImpl);
