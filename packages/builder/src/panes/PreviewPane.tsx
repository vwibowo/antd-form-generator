import { Card, Col, Empty, Row, Typography } from 'antd';
import { useState } from 'react';
import { ScreenRenderer } from '@antd-form-generator/core/renderer/ScreenRenderer';
import type { ScreenSchema } from '@antd-form-generator/core/schema/screen';
import { screenCollectsValues } from '@antd-form-generator/core/schema/screen';
import { JsonValuesEditor } from './JsonValuesEditor';
import { jsonReplacer } from './jsonReplacer';

export interface PreviewPaneProps {
  schema: ScreenSchema;
}

/**
 * The screen as a run would show it, next to what it produced.
 *
 * A screen that collects values is driven by filling it in, so the right pane
 * shows the submitted payload. One that only tells has nothing to submit and
 * nowhere to get a payload from, so the right pane becomes the payload *input*
 * instead — which is what the page preview used to be.
 */
export function PreviewPane({ schema }: PreviewPaneProps) {
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const collects = screenCollectsValues(schema);

  const handleAction = (actionId: string, actionValues: Record<string, unknown>) =>
    setSubmitted({ ...actionValues, action: actionId });

  return (
    <Row gutter={16} style={{ padding: 16, height: 'calc(100vh - 100px)' }}>
      <Col xs={24} lg={14}>
        <Card size="small" title="Rendered screen">
          <ScreenRenderer
            schema={schema}
            values={collects ? undefined : values}
            onSubmit={setSubmitted}
            onAction={handleAction}
          />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        {collects ? (
          <Card size="small" title="Submitted values">
            {submitted ? (
              <pre
                data-testid="submitted-values"
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(submitted, jsonReplacer, 2)}
              </pre>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Typography.Text type="secondary">
                    Submit the screen to see its payload
                  </Typography.Text>
                }
              />
            )}
          </Card>
        ) : (
          <Card size="small" title="Payload">
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Nothing here collects a value, so type the payload this screen is showing.
            </Typography.Paragraph>
            <JsonValuesEditor
              title="Values"
              help="Keys here fill in {{token}} text and drive block conditions."
              values={values}
              onChange={setValues}
            />
          </Card>
        )}
      </Col>
    </Row>
  );
}
