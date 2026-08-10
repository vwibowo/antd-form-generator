import { Input, InputNumber, Segmented, Select, Switch, Typography } from 'antd';
import { useFormBuilderStore } from '@/store/SchemaStoreContext';
import { Labeled } from './inspector/Labeled';

const COL_OPTIONS = [4, 6, 8, 10, 12].map((span) => ({ label: `${span}/24`, value: span }));

/** Form-level settings, shown in the inspector when no field is selected. */
export function FormSettings() {
  const schema = useFormBuilderStore((state) => state.schema);
  const updateSettings = useFormBuilderStore((state) => state.updateSettings);

  return (
    <div>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
        Form settings
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

      <Labeled label="Layout">
        <Segmented
          size="small"
          block
          value={schema.layout}
          options={[
            { label: 'Vertical', value: 'vertical' },
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Inline', value: 'inline' },
          ]}
          onChange={(layout) =>
            updateSettings({ layout: layout as 'vertical' | 'horizontal' | 'inline' })
          }
        />
      </Labeled>

      {schema.layout === 'horizontal' ? (
        <>
          <Labeled label="Label column width">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={schema.labelCol?.span ?? 6}
              options={COL_OPTIONS}
              onChange={(span) => updateSettings({ labelCol: { span } })}
            />
          </Labeled>
          <Labeled label="Wrapper column width">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={schema.wrapperCol?.span ?? 18}
              options={[14, 16, 18, 20].map((span) => ({ label: `${span}/24`, value: span }))}
              onChange={(span) => updateSettings({ wrapperCol: { span } })}
            />
          </Labeled>
        </>
      ) : null}

      <Labeled label="Control size">
        <Segmented
          size="small"
          block
          value={schema.size}
          options={[
            { label: 'Small', value: 'small' },
            { label: 'Middle', value: 'middle' },
            { label: 'Large', value: 'large' },
          ]}
          onChange={(size) => updateSettings({ size: size as 'small' | 'middle' | 'large' })}
        />
      </Labeled>

      <Labeled label="Column gutter">
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          max={48}
          value={schema.gutter}
          onChange={(gutter) => updateSettings({ gutter: gutter ?? 16 })}
        />
      </Labeled>

      <Labeled label="Submit button text">
        <Input
          size="small"
          value={schema.submitText}
          onChange={(event) => updateSettings({ submitText: event.target.value })}
        />
      </Labeled>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Switch
          size="small"
          checked={schema.colon}
          onChange={(colon) => updateSettings({ colon })}
        />
        <Typography.Text style={{ fontSize: 13 }}>Colon after labels</Typography.Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          size="small"
          checked={schema.showReset}
          onChange={(showReset) => updateSettings({ showReset })}
        />
        <Typography.Text style={{ fontSize: 13 }}>Show reset button</Typography.Text>
      </div>
    </div>
  );
}
