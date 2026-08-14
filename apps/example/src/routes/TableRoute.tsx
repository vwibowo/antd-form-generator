import type { TableSchema } from '@antd-form-generator/core';
import { TableRenderer } from '@antd-form-generator/core';
import { App, Card, Empty, Space, Tag, Typography } from 'antd';
import { Link, useParams } from 'react-router';
import { documentsOfKind, getDocument } from '../lib/documentLibrary';
import { Page } from '../layout/Page';

/** Every table document, when no particular one was asked for. */
function TableIndex() {
  const tables = documentsOfKind('table');
  return (
    <Page title="Data" subtitle="Table documents. One reads inline rows, one reads an API.">
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {tables.length === 0 ? <Empty description="No table documents" /> : null}
        {tables.map((entry) => (
          <Card key={entry.id} size="small" title={<Link to={`/tables/${entry.id}`}>{entry.title}</Link>}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {entry.description}
            </Typography.Text>
          </Card>
        ))}
      </Space>
    </Page>
  );
}

/**
 * One table document.
 *
 * Selection and bulk actions leave through callbacks, exactly as they would in a
 * host app — the document only carries an action's id and label, and what
 * `act_void` *means* is this console's business, not the schema's.
 */
export function TableRoute() {
  const { id } = useParams();
  const { message } = App.useApp();

  if (!id) return <TableIndex />;

  const entry = getDocument(id);
  if (!entry || entry.kind !== 'table') return <TableIndex />;

  return (
    <Page title={entry.title} subtitle={entry.description} extra={<Tag color="green">table</Tag>}>
      <Card size="small">
        <TableRenderer
          schema={entry.schema as TableSchema}
          onAction={(actionId, keys) =>
            message.success(`${actionId} on ${keys.length} row${keys.length === 1 ? '' : 's'}`)
          }
        />
      </Card>
    </Page>
  );
}
