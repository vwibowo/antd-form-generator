import { memo } from 'react';
import type { WorkflowEdge, WorkflowNode } from '@antd-form-generator/core/schema/workflow';
import { edgeCaption } from './conditionText';
import type { ActiveDrag } from './dndTypes';
import type { PortSlot } from './edgeGeometry';
import { routeWorkflowEdge, waypointMidpoint } from './edgeGeometry';

export interface EdgeChipsProps {
  edges: WorkflowEdge[];
  nodes: Map<string, WorkflowNode>;
  slots: Map<string, PortSlot>;
  selectedEdgeId: string | null;
  onSelect: (id: string) => void;
  /** The in-flight drag, so a chip rides its curve instead of staying behind. */
  drag: ActiveDrag | null;
}

/**
 * Condition labels parked on each branch.
 *
 * HTML rather than SVG `<text>`: these need ellipsis, a background and a hover
 * state, all of which are one line in CSS and a fight in SVG. They sit in their
 * own layer above the curves and below nothing — a chip is also the easiest
 * thing on the canvas to click when the line itself is short.
 *
 * Routed through the same `routeWorkflowEdge` the lines use, so a chip cannot
 * drift off the branch it labels — including onto a card when its branch is
 * running along the lane underneath them.
 */
function EdgeChipsImpl({ edges, nodes, slots, selectedEdgeId, onSelect, drag }: EdgeChipsProps) {
  return (
    <>
      {edges.map((edge) => {
        const caption = edgeCaption(edge.label, edge.condition, edge.isDefault);
        if (!caption) return null;

        const routed = routeWorkflowEdge(edge, nodes, slots, drag);
        if (!routed) return null;

        const point = waypointMidpoint(routed.points, routed.selfLoop);

        return (
          <button
            key={edge.id}
            type="button"
            className={`fg-wf-chip${selectedEdgeId === edge.id ? ' fg-wf-chip--selected' : ''}${
              edge.isDefault ? ' fg-wf-chip--default' : ''
            }`}
            style={{ left: point.x, top: point.y }}
            title={caption}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(edge.id);
            }}
          >
            {caption}
          </button>
        );
      })}
    </>
  );
}

export const EdgeChips = memo(EdgeChipsImpl);
