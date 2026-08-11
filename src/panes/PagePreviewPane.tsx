import { Alert, Card, Col, Row, Space, Typography } from 'antd';
import { useState } from 'react';
import { PageRenderer } from '@/renderer/page/PageRenderer';
import type { PageSchema } from '@/schema/page';
import { JsonValuesEditor } from './JsonValuesEditor';

export interface PagePreviewPaneProps {
  schema: PageSchema;
}

/**
 * The page rendered against a payload you can type.
 *
 * A standalone page has no run behind it, so the values its `{{token}}` text
 * and block conditions read have to come from somewhere — the same problem the
 * Summary tab has, solved the same way.
 */
export function PagePreviewPane({ schema }: PagePreviewPaneProps) {
  const [pressed, setPressed] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});

  return (
    <Row gutter={16} style={{ padding: 16 }}>
      <Col xs={24} lg={14}>
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {pressed ? (
            <Alert
              type="info"
              showIcon
              closable
              onClose={() => setPressed(null)}
              message={
                <>
                  Pressed <Typography.Text code>{pressed}</Typography.Text> — inside a workflow this
                  is what the next branch would test.
                </>
              }
            />
          ) : null}

          <Card size="small" title={schema.title || 'Page'}>
            <PageRenderer schema={schema} values={values} onAction={setPressed} />
          </Card>
        </Space>
      </Col>

      <Col xs={24} lg={10}>
        <JsonValuesEditor
          title="Payload"
          help="What a run would have collected by the time this page shows."
          values={values}
          onChange={setValues}
        />
      </Col>
    </Row>
  );
}
