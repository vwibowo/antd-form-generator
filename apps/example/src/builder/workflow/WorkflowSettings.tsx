import { Input, Segmented, Typography } from 'antd';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { Labeled } from '../inspector/Labeled';

/** Workflow-level settings, shown in the inspector when nothing is selected. */
export function WorkflowSettings() {
  const schema = useWorkflowStore((state) => state.schema);
  const updateSettings = useWorkflowStore((state) => state.updateSettings);

  return (
    <div>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
        Workflow settings
      </Typography.Text>

      <Labeled label="Title">
        <Input
          size="small"
          value={schema.title ?? ''}
          onChange={(event) => updateSettings({ title: event.target.value || undefined })}
        />
      </Labeled>

      <Labeled label="Description">
        <Input.TextArea
          size="small"
          rows={2}
          value={schema.description ?? ''}
          onChange={(event) => updateSettings({ description: event.target.value || undefined })}
        />
      </Labeled>

      <Labeled label="Branch style" help="Presentation only — the route is the same either way.">
        <Segmented
          size="small"
          block
          value={schema.edgeStyle}
          options={[
            { label: 'Curved', value: 'curve' },
            { label: 'Stepped', value: 'step' },
          ]}
          onChange={(edgeStyle) => updateSettings({ edgeStyle: edgeStyle as 'curve' | 'step' })}
        />
      </Labeled>

      <Labeled label="Size">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {schema.nodes.length} step{schema.nodes.length === 1 ? '' : 's'}, {schema.edges.length}{' '}
          branch{schema.edges.length === 1 ? '' : 'es'}
        </Typography.Text>
      </Labeled>
    </div>
  );
}
