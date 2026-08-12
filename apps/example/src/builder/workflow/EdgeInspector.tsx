import { DeleteOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select, Switch, Typography } from 'antd';
import { useMemo } from 'react';
import type { WorkflowEdge } from '@antd-form-generator/core/schema/workflow';
import { collectWorkflowNames, orderedOutgoing } from '@antd-form-generator/core/schema/workflowGraph';
import { nodeCaption } from '@antd-form-generator/core/schema/workflowRegistry';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { ConditionEditor } from '../inspector/ConditionEditor';
import { Labeled } from '../inspector/Labeled';

export interface EdgeInspectorProps {
  edge: WorkflowEdge;
}

export function EdgeInspector({ edge }: EdgeInspectorProps) {
  const schema = useWorkflowStore((state) => state.schema);
  const updateEdge = useWorkflowStore((state) => state.updateEdge);
  const removeEdge = useWorkflowStore((state) => state.removeEdge);

  const patch = (next: Partial<WorkflowEdge>) => updateEdge(edge.id, next);

  const nodeOptions = useMemo(
    () => schema.nodes.map((node) => ({ label: nodeCaption(node), value: node.id })),
    [schema.nodes],
  );

  // Only top-level payload keys: a condition's field is resolved as one path
  // segment, so a field inside a repeatable row cannot be branched on.
  const fieldChoices = useMemo(
    () =>
      collectWorkflowNames(schema).map((entry) => ({
        label: `${entry.label} (${entry.name})`,
        value: entry.name,
      })),
    [schema],
  );

  const siblings = orderedOutgoing(schema, edge.from);
  const position = siblings.findIndex((entry) => entry.id === edge.id);

  return (
    <div style={{ padding: 12 }}>
      <Labeled label="Goes to">
        <Select
          size="small"
          style={{ width: '100%' }}
          value={edge.to}
          options={nodeOptions}
          onChange={(to) => patch({ to })}
        />
      </Labeled>

      <Labeled label="Label on the canvas" help="Blank shows a summary of the condition instead.">
        <Input
          size="small"
          value={edge.label}
          placeholder="Approved"
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Labeled>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Switch
          size="small"
          checked={edge.isDefault}
          onChange={(isDefault) => patch({ isDefault })}
        />
        <Typography.Text style={{ fontSize: 13 }}>Fallback branch</Typography.Text>
      </div>

      {edge.isDefault ? (
        <Typography.Paragraph type="secondary" style={{ fontSize: 11 }}>
          Taken only once every other branch out of this step has been tried and none matched. A
          step without one stops the run when nothing matches.
        </Typography.Paragraph>
      ) : (
        <>
          <Labeled
            label="Tried in position"
            help={
              siblings.length > 1
                ? `${position + 1} of ${siblings.length}. Lower runs first, and the first match wins.`
                : 'The only conditional branch out of this step.'
            }
          >
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={0}
              max={99}
              value={edge.priority}
              onChange={(priority) => patch({ priority: priority ?? 0 })}
            />
          </Labeled>

          <ConditionEditor
            condition={edge.condition}
            fieldChoices={fieldChoices}
            onChange={(condition) => patch({ condition })}
            label="Take this branch when…"
            hint="Values are read from everything collected so far, so a branch can test an answer given several steps back."
          />
        </>
      )}

      <Button
        danger
        size="small"
        block
        icon={<DeleteOutlined />}
        style={{ marginTop: 16 }}
        onClick={() => removeEdge(edge.id)}
      >
        Delete branch
      </Button>
    </div>
  );
}
