import { Card, Typography } from 'antd';
import { TableRenderer } from '@/renderer/table/TableRenderer';
import type { TableSchema } from '@/schema/table';

export interface TablePreviewPaneProps {
  schema: TableSchema;
}

/** The table on its own, the way a host app would embed it. */
export function TablePreviewPane({ schema }: TablePreviewPaneProps) {
  const source = schema.source;

  return (
    <div style={{ padding: 16 }}>
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
        <TableRenderer schema={schema} />
      </Card>
    </div>
  );
}
