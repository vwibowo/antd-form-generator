import { Input, InputNumber, Typography } from 'antd';
import { usePageBuilderStore } from '@/store/PageStoreContext';
import { Labeled } from '../inspector/Labeled';

/** Page-level settings, shown in the inspector when no block is selected. */
export function PageSettings() {
  const schema = usePageBuilderStore((state) => state.schema);
  const updateSettings = usePageBuilderStore((state) => state.updateSettings);

  return (
    <div>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
        Page settings
      </Typography.Text>

      <Labeled label="Title" help="Takes {{fieldName}} too.">
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

      <Labeled label="Content width" help="A screen reads badly full-bleed.">
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={320}
          max={1600}
          step={40}
          value={schema.maxWidth}
          onChange={(maxWidth) => updateSettings({ maxWidth: maxWidth ?? 880 })}
        />
      </Labeled>

      <Labeled label="Block spacing">
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          max={48}
          value={schema.gutter}
          onChange={(gutter) => updateSettings({ gutter: gutter ?? 16 })}
        />
      </Labeled>

      <Labeled label="Size">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {schema.blocks.length} block{schema.blocks.length === 1 ? '' : 's'}
        </Typography.Text>
      </Labeled>
    </div>
  );
}
