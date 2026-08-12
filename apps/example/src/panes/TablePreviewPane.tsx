import { Card, Col, Empty, Row, Typography } from 'antd';
import type { Key } from 'react';
import { useState } from 'react';
import { TableRenderer } from '@antd-form-generator/core/renderer/table/TableRenderer';
import type { TableRow } from '@antd-form-generator/core/renderer/table/columns';
import type { TableSchema } from '@antd-form-generator/core/schema/table';

export interface TablePreviewPaneProps {
  schema: TableSchema;
}

interface Fired {
  actionId: string;
  keys: Key[];
}

/** The table on its own, the way a host app would embed it. */
export function TablePreviewPane({ schema }: TablePreviewPaneProps) {
  const source = schema.source;
  const [selected, setSelected] = useState<{ keys: Key[]; rows: TableRow[] }>({
    keys: [],
    rows: [],
  });
  const [fired, setFired] = useState<Fired | null>(null);

  // Selection and actions leave the renderer through callbacks, so this pane
  // stands in for the host app — the same way the form preview stands in for
  // whatever would receive a submitted payload.
  const interactive = schema.selection.enabled;

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={16}>
        <Col xs={24} lg={interactive ? 16 : 24}>
          <Card
            size="small"
            title="Rendered table"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {source.kind === 'remote'
                  ? `${source.url || 'no URL set'} · ${source.paging === 'server' ? 'server paging' : 'paged in browser'}`
                  : `${source.rows.length} inline row${source.rows.length === 1 ? '' : 's'}`}
              </Typography.Text>
            }
          >
            <TableRenderer
              schema={schema}
              onSelectionChange={(keys, rows) => setSelected({ keys, rows })}
              onAction={(actionId, keys) => setFired({ actionId, keys })}
            />
          </Card>
        </Col>

        {interactive ? (
          <Col xs={24} lg={8}>
            <Card size="small" title="Selection">
              {selected.keys.length > 0 ? (
                <pre
                  data-testid="selected-keys"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(selected.keys, null, 2)}
                </pre>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Typography.Text type="secondary">Pick a row to see its key</Typography.Text>
                  }
                />
              )}

              {fired ? (
                <Typography.Paragraph
                  data-testid="fired-action"
                  type="secondary"
                  style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}
                >
                  Last action: <code>{fired.actionId}</code> on {fired.keys.length} row
                  {fired.keys.length === 1 ? '' : 's'}
                </Typography.Paragraph>
              ) : null}
            </Card>
          </Col>
        ) : null}
      </Row>
    </div>
  );
}
