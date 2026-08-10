import { useDroppable } from '@dnd-kit/core';
import { Empty, Typography } from 'antd';
import { useMemo } from 'react';
import type { RefObject } from 'react';
import type { WorkflowIssue } from '@/schema/workflowGraph';
import { validateWorkflow } from '@/schema/workflowGraph';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { type ActiveDrag, type StageDropData, WF_STAGE_ID } from './dndTypes';
import { edgePortSlots, stageSize } from './edgeGeometry';
import { EdgeChips } from './EdgeChips';
import { EdgeLayer } from './EdgeLayer';
import { NodeCard } from './NodeCard';
import { PendingEdge } from './PendingEdge';

export interface GraphCanvasProps {
  /** The scroll container, needed to turn a drop point into stage coordinates. */
  stageRef: RefObject<HTMLDivElement | null>;
  /** The in-flight drag, so branches can follow the card. */
  drag: ActiveDrag | null;
}

/**
 * Shared empty array for nodes with nothing to flag.
 *
 * `?? []` here would mint a new array on every render and defeat `NodeCard`'s
 * memo — which is the whole reason a pointer move used to re-render every card
 * on the canvas.
 */
const NO_ISSUES: WorkflowIssue[] = [];

export function GraphCanvas({ stageRef, drag }: GraphCanvasProps) {
  const schema = useWorkflowStore((state) => state.schema);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const selectEdge = useWorkflowStore((state) => state.selectEdge);

  const stageData: StageDropData = { source: 'wf-stage' };
  const { setNodeRef: setStageDropRef } = useDroppable({ id: WF_STAGE_ID, data: stageData });

  const size = useMemo(() => stageSize(schema.nodes), [schema.nodes]);
  const byId = useMemo(
    () => new Map(schema.nodes.map((node) => [node.id, node])),
    [schema.nodes],
  );
  // Depends on the edge list alone, so dragging a card never recomputes it.
  const slots = useMemo(() => edgePortSlots(schema.edges), [schema.edges]);

  // Recomputed with the document rather than on a timer: the graph is small
  // enough that a full validation pass per edit is cheaper than tracking which
  // issues a change could have invalidated. It does not run mid-drag, because
  // the store is only written on drop.
  const issuesByNode = useMemo(() => {
    const map = new Map<string, WorkflowIssue[]>();
    for (const issue of validateWorkflow(schema)) {
      if (!issue.nodeId) continue;
      map.set(issue.nodeId, [...(map.get(issue.nodeId) ?? []), issue]);
    }
    return map;
  }, [schema]);

  // Node cards are drop targets for exactly one gesture: landing a branch
  // pulled out of a port. Registering them the rest of the time only gives
  // dnd-kit more rectangles to collide against on every pointer move.
  const connecting = drag?.kind === 'port';

  return (
    <div
      className="fg-wf-stage fg-scroll"
      ref={(element) => {
        stageRef.current = element;
        setStageDropRef(element);
      }}
      onClick={() => {
        selectNode(null);
        selectEdge(null);
      }}
    >
      <div className="fg-wf-canvas" style={{ width: size.width, height: size.height }}>
        <EdgeLayer
          edges={schema.edges}
          nodes={byId}
          slots={slots}
          style={schema.edgeStyle}
          width={size.width}
          height={size.height}
          selectedEdgeId={selectedEdgeId}
          onSelect={selectEdge}
          drag={drag}
        />

        <PendingEdge
          nodes={byId}
          drag={drag}
          width={size.width}
          height={size.height}
        />

        {schema.nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            selected={selectedNodeId === node.id}
            issues={issuesByNode.get(node.id) ?? NO_ISSUES}
            connecting={connecting}
          />
        ))}

        <EdgeChips
          edges={schema.edges}
          nodes={byId}
          slots={slots}
          selectedEdgeId={selectedEdgeId}
          onSelect={selectEdge}
          drag={drag}
        />

        {schema.nodes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ position: 'absolute', left: 48, top: 64 }}
            description={
              <Typography.Text type="secondary">
                Drag a step from the left to start
              </Typography.Text>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
