import { Button, Empty, Form, Row, Space, Typography } from 'antd';
import { useEffect, useMemo } from 'react';
import type { FormSchema } from '@/schema/schema';
import { FieldRenderer } from './FieldRenderer';
import { buildInitialValues, collectPayloadKeys } from './initialValues';

export interface FormRendererProps {
  schema: FormSchema;
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Hide the submit/reset row when the host supplies its own actions. */
  showActions?: boolean;
}

/**
 * Renders a `FormSchema` as a working antd form.
 *
 * This module and everything it imports are deliberately free of builder
 * imports, so `src/renderer/` can be lifted into a standalone package.
 */
export function FormRenderer({ schema, onSubmit, showActions = true }: FormRendererProps) {
  const [form] = Form.useForm();

  // No form-wide `useWatch` here on purpose: it would re-render every field on
  // every keystroke. Each field subscribes to its own visibility instead —
  // see `useFieldVisibility`.
  const initialValues = useMemo(() => buildInitialValues(schema), [schema]);
  const payloadKeys = useMemo(() => collectPayloadKeys(schema), [schema]);

  // The builder mutates the schema live, so re-seed on every change: new
  // defaults appear, already-typed values survive, and anything whose field no
  // longer exists is dropped — otherwise loading a different form (Sample,
  // Import, a JSON edit) would leave the previous form's values behind.
  useEffect(() => {
    const current = form.getFieldsValue(true) as Record<string, unknown>;
    const stale = Object.keys(current).filter((key) => !payloadKeys.has(key));
    if (stale.length > 0) {
      form.resetFields(stale);
      for (const key of stale) delete current[key];
    }
    form.setFieldsValue({ ...initialValues, ...current });
  }, [form, initialValues, payloadKeys]);

  if (schema.fields.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="This form has no fields yet"
        style={{ padding: '48px 0' }}
      />
    );
  }

  return (
    <Form
      form={form}
      layout={schema.layout}
      size={schema.size}
      colon={schema.colon}
      labelCol={schema.layout === 'horizontal' ? schema.labelCol : undefined}
      wrapperCol={schema.layout === 'horizontal' ? schema.wrapperCol : undefined}
      initialValues={initialValues}
      onFinish={(submitted) => onSubmit?.(submitted as Record<string, unknown>)}
      requiredMark
    >
      {schema.title ? (
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {schema.title}
        </Typography.Title>
      ) : null}
      {schema.description ? (
        <Typography.Paragraph type="secondary">{schema.description}</Typography.Paragraph>
      ) : null}

      <Row gutter={schema.gutter}>
        {schema.fields.map((node) => (
          <FieldRenderer
            key={node.id}
            node={node}
            scopePath={[]}
            namePrefix={[]}
            gutter={schema.gutter}
          />
        ))}
      </Row>

      {showActions ? (
        <Form.Item style={{ marginTop: 8 }}>
          <Space>
            <Button type="primary" htmlType="submit">
              {schema.submitText}
            </Button>
            {schema.showReset ? (
              <Button
                htmlType="button"
                onClick={() => {
                  form.resetFields();
                }}
              >
                Reset
              </Button>
            ) : null}
          </Space>
        </Form.Item>
      ) : null}
    </Form>
  );
}
