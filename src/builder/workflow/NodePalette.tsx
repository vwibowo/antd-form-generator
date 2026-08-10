import {
  ApartmentOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  FormOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { Typography } from 'antd';
import type { ReactNode } from 'react';
import { WORKFLOW_NODE_KINDS } from '@/schema/workflow';
import type { WorkflowNodeKind } from '@/schema/workflow';
import { workflowMetaFor } from '@/schema/workflowRegistry';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { type NodePaletteDragData, nodePaletteDraggableId } from './dndTypes';

const ICONS: Record<WorkflowNodeKind, ReactNode> = {
  start: <PlayCircleOutlined />,
  form: <FormOutlined />,
  decision: <ApartmentOutlined />,
  action: <ThunderboltOutlined />,
  approval: <AuditOutlined />,
  end: <CheckCircleOutlined />,
};

export function nodeIcon(kind: WorkflowNodeKind): ReactNode {
  return ICONS[kind];
}

function PaletteItem({ kind }: { kind: WorkflowNodeKind }) {
  const addNode = useWorkflowStore((state) => state.addNode);
  const nodes = useWorkflowStore((state) => state.schema.nodes);
  const meta = workflowMetaFor(kind);
  const data: NodePaletteDragData = { source: 'wf-palette', kind };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: nodePaletteDraggableId(kind),
    data,
  });

  return (
    <div
      ref={setNodeRef}
      className="fg-palette-item fg-wf-palette-item"
      style={{ opacity: isDragging ? 0.4 : 1, borderLeftColor: meta.color }}
      // Dragging places the node where it lands; clicking drops it below
      // whatever is already there, as a keyboard/touch-friendly fallback.
      onClick={() => {
        const lowest = nodes.reduce((max, node) => Math.max(max, node.y), 0);
        addNode(kind, { x: 48, y: nodes.length === 0 ? 48 : lowest + 128 });
      }}
      {...listeners}
      {...attributes}
    >
      {ICONS[kind]}
      <span>{meta.label}</span>
    </div>
  );
}

export function NodePalette() {
  return (
    <div style={{ padding: 12 }}>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        Steps
      </Typography.Text>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {WORKFLOW_NODE_KINDS.map((kind) => (
          <PaletteItem key={kind} kind={kind} />
        ))}
      </div>

      <Typography.Paragraph type="secondary" style={{ fontSize: 11, marginTop: 16 }}>
        Drag a step onto the canvas, then drag the dot on its right edge onto
        another step to branch. Click a branch to give it a condition.
      </Typography.Paragraph>
    </div>
  );
}
