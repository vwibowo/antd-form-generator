import { memo } from 'react';
import type { WorkflowEdge, WorkflowNode } from '@/schema/workflow';
import type { ActiveDrag } from './dndTypes';
import type { EdgeStyle, PortSlot } from './edgeGeometry';
import { pathFromWaypoints, routeWorkflowEdge } from './edgeGeometry';

export interface EdgeLayerProps {
  edges: WorkflowEdge[];
  /** Node lookup by id — edges whose ends are missing are simply not drawn. */
  nodes: Map<string, WorkflowNode>;
  /** Which slot on each card's edge every branch owns. */
  slots: Map<string, PortSlot>;
  style: EdgeStyle;
  width: number;
  height: number;
  selectedEdgeId: string | null;
  onSelect: (id: string) => void;
  /** The in-flight drag, applied to whichever endpoint is being moved. */
  drag: ActiveDrag | null;
}

const ARROW_ID = 'fg-wf-arrow';
const ARROW_SELECTED_ID = 'fg-wf-arrow-selected';

/**
 * The branches, drawn under the node cards.
 *
 * Each edge is two paths: the visible curve, and a fat transparent one on top
 * of it that takes the clicks. A 2px line is close to unhittable with a mouse,
 * and widening the visible stroke to compensate would bury the graph.
 *
 * This is the one layer that re-renders during a drag, and deliberately so —
 * recomputing a dozen routes is arithmetic, while the node cards it sits under
 * are antd subtrees that must not.
 */
function EdgeLayerImpl({
  edges,
  nodes,
  slots,
  style,
  width,
  height,
  selectedEdgeId,
  onSelect,
  drag,
}: EdgeLayerProps) {
  return (
    <svg className="fg-wf-edges" width={width} height={height} aria-hidden>
      <defs>
        <marker
          id={ARROW_ID}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(5, 5, 5, 0.35)" />
        </marker>
        <marker
          id={ARROW_SELECTED_ID}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1677ff" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const routed = routeWorkflowEdge(edge, nodes, slots, drag);
        if (!routed) return null;

        const d = pathFromWaypoints(routed.points, style, routed.selfLoop);
        const selected = selectedEdgeId === edge.id;

        return (
          <g key={edge.id}>
            <path
              className={`fg-wf-edge${selected ? ' fg-wf-edge--selected' : ''}${
                edge.isDefault ? ' fg-wf-edge--default' : ''
              }`}
              d={d}
              markerEnd={`url(#${selected ? ARROW_SELECTED_ID : ARROW_ID})`}
            />
            <path
              className="fg-wf-edge-hit"
              d={d}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(edge.id);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export const EdgeLayer = memo(EdgeLayerImpl);
