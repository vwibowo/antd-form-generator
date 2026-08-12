import { Tag, Typography } from 'antd';
import { nodeCaption, workflowMetaFor } from '@antd-form-generator/core/schema/workflowRegistry';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { EdgeInspector } from './EdgeInspector';
import { NodeInspector } from './NodeInspector';
import { ProblemList } from './ProblemList';
import { WorkflowSettings } from './WorkflowSettings';

export interface WorkflowInspectorProps {
  onEditScreen: (id: string) => void;
}

/**
 * Right pane: whichever of a step, a branch or the document itself is in focus.
 *
 * Selecting one clears the other in the store, so this never has to decide
 * which wins.
 */
export function WorkflowInspector({ onEditScreen }: WorkflowInspectorProps) {
  const schema = useWorkflowStore((state) => state.schema);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);

  const node = schema.nodes.find((entry) => entry.id === selectedNodeId) ?? null;
  const edge = schema.edges.find((entry) => entry.id === selectedEdgeId) ?? null;

  if (node) {
    const meta = workflowMetaFor(node.kind);
    return (
      <div className="fg-scroll" style={{ height: '100%' }}>
        <div className="fg-wf-inspector__head">
          <Typography.Text strong style={{ fontSize: 13 }}>
            {nodeCaption(node)}
          </Typography.Text>
          <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
            {meta.label}
          </Tag>
        </div>
        <NodeInspector node={node} onEditScreen={onEditScreen} />
      </div>
    );
  }

  if (edge) {
    const from = schema.nodes.find((entry) => entry.id === edge.from);
    const to = schema.nodes.find((entry) => entry.id === edge.to);
    return (
      <div className="fg-scroll" style={{ height: '100%' }}>
        <div className="fg-wf-inspector__head">
          <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
            {from ? nodeCaption(from) : edge.from} → {to ? nodeCaption(to) : edge.to}
          </Typography.Text>
        </div>
        <EdgeInspector edge={edge} />
      </div>
    );
  }

  return (
    <div className="fg-scroll" style={{ height: '100%', padding: 12 }}>
      <WorkflowSettings />
      <ProblemList />
    </div>
  );
}
