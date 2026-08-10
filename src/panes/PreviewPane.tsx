import { Card, Col, Empty, Row, Typography } from 'antd';
import { useState } from 'react';
import { FormRenderer } from '@/renderer/FormRenderer';
import type { FormSchema } from '@/schema/schema';
import { jsonReplacer } from './jsonReplacer';

export interface PreviewPaneProps {
  schema: FormSchema;
}

/** Live form plus the payload it produced, so submissions are verifiable. */
export function PreviewPane({ schema }: PreviewPaneProps) {
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);

  return (
    <Row gutter={16} style={{ padding: 16, height: "calc(100vh - 100px)" }}>
      <Col xs={24} lg={14}>
        <Card size="small" title="Rendered form">
          <FormRenderer schema={schema} onSubmit={setSubmitted} />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
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
                  Submit the form to see its payload
                </Typography.Text>
              }
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}
