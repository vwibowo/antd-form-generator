import { CopyOutlined, DeleteOutlined, HolderOutlined, WarningOutlined } from '@ant-design/icons';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Badge, Button, Tooltip, Typography } from 'antd';
import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { WorkflowNode } from '@/schema/workflow';
import type { WorkflowIssue } from '@/schema/workflowGraph';
import { workflowMetaFor } from '@/schema/workflowRegistry';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { NODE_HEIGHT, NODE_WIDTH } from './edgeGeometry';
import {
  type NodeDropData,
  type NodeMoveDragData,
  type PortDragData,
  nodeDroppableId,
  portDraggableId,
} from './dndTypes';
import { nodeIcon } from './NodePalette';

interface NodeCardProps {
  node: WorkflowNode;
  selected: boolean;
  /** Must be reference-stable — see `NO_ISSUES` in `GraphCanvas`. */
  issues: WorkflowIssue[];
  /** True while a branch is being pulled out of some port. */
  connecting: boolean;
}

/**
 * One node on the canvas.
 *
 * A droppable wrapper holds a draggable card: nesting the two rather than
 * merging refs onto one element keeps the "land a branch here" target and the
 * "move me" target apart with no ref plumbing. Dragging is bound to the grip
 * strip only — the same split `Canvas.tsx` uses — so clicking the card selects
 * it and the output port's own drag is never swallowed.
 *
 * Memoised, and that matters: dnd-kit hands every draggable and droppable a new
 * context value on every pointer move, so without the memo each move would
 * re-render every card on the canvas — two tooltips, two buttons and two
 * text-measuring `Typography.Text`s apiece.
 */
function NodeCardImpl({ node, selected, issues, connecting }: NodeCardProps) {
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const duplicateNode = useWorkflowStore((state) => state.duplicateNode);

  const meta = workflowMetaFor(node.kind);

  const dropData: NodeDropData = { source: 'wf-node-drop', id: node.id };
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: nodeDroppableId(node.id),
    data: dropData,
    // Landing a branch is the only thing that drops onto a card: a node move
    // works off `delta` and a palette drop resolves against the stage, so
    // neither ever reads `over`. Keeping these unregistered the rest of the
    // time is what stops collision detection walking every card per move.
    disabled: !connecting,
  });

  const moveData: NodeMoveDragData = { source: 'wf-node', id: node.id };
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: node.id, data: moveData });

  const portData: PortDragData = { source: 'wf-port', from: node.id };
  const {
    attributes: portAttributes,
    listeners: portListeners,
    setNodeRef: setPortRef,
    isDragging: portDragging,
  } = useDraggable({ id: portDraggableId(node.id), data: portData });

  const style: CSSProperties = {
    // Live feedback while dragging; the store gets the final position on drop.
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    borderColor: selected ? meta.color : undefined,
    boxShadow: selected ? `0 0 0 2px ${meta.color}33` : undefined,
  };

  const errors = issues.filter((issue) => issue.level === 'error');
  const problem = errors[0] ?? issues[0];

  return (
    // The wrapper is the branch's landing pad and stays put while the card
    // inside it is dragged, so a drop always resolves against where the node
    // actually is.
    <div
      ref={setDropRef}
      className="fg-wf-node-drop"
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        zIndex: isDragging ? 20 : selected ? 10 : 1,
      }}
    >
      <div
        ref={setDragRef}
        className={`fg-wf-node fg-wf-node--${node.kind}${selected ? ' fg-wf-node--selected' : ''}${
          isOver ? ' fg-wf-node--over' : ''
        }`}
        style={style}
        onClick={(event) => {
          event.stopPropagation();
          selectNode(node.id);
        }}
      >
        <div className="fg-wf-node__grip" {...listeners} {...attributes} aria-label="Move step">
          <HolderOutlined />
        </div>

        <div className="fg-wf-node__body">
          <div className="fg-wf-node__title">
            <span style={{ color: meta.color }}>{nodeIcon(node.kind)}</span>
            <Typography.Text ellipsis strong style={{ fontSize: 13 }}>
              {node.label || meta.label}
            </Typography.Text>
            {problem ? (
              <Tooltip title={problem.message}>
                <WarningOutlined
                  style={{ color: problem.level === 'error' ? '#ff4d4f' : '#faad14' }}
                />
              </Tooltip>
            ) : null}
          </div>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 11 }}>
            {node.description || meta.hint}
          </Typography.Text>
        </div>

        <div className="fg-wf-node__actions">
          <Tooltip title="Duplicate">
            <Button
              size="small"
              type="text"
              icon={<CopyOutlined />}
              aria-label="Duplicate step"
              onClick={(event) => {
                event.stopPropagation();
                duplicateNode(node.id);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Delete step"
              onClick={(event) => {
                event.stopPropagation();
                removeNode(node.id);
              }}
            />
          </Tooltip>
        </div>

        {node.kind === 'form' ? (
          <Badge
            className="fg-wf-node__count"
            count={node.form?.fields.length ?? 0}
            showZero
            color={meta.color}
            title={`${node.form?.fields.length ?? 0} fields`}
          />
        ) : null}

        {meta.supports.outPort ? (
          <div
            ref={setPortRef}
            className={`fg-wf-node__port${portDragging ? ' fg-wf-node__port--active' : ''}`}
            style={{ background: meta.color }}
            aria-label="Draw a branch from this step"
            {...portListeners}
            {...portAttributes}
          />
        ) : null}
      </div>
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
