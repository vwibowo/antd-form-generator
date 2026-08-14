import { DeleteOutlined } from '@ant-design/icons';
import { TableRenderer } from '@antd-form-generator/core';
import { App, Alert, Button, Card, Empty, Popconfirm, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { buildInboxTable } from '../lib/inboxTable';
import { clearSubmissions, listSubmissions } from '../lib/submissions';
import { Page } from '../layout/Page';

/**
 * Everything staff have sent in — shown through a document nobody wrote.
 *
 * This is the one page in the console whose schema is computed rather than
 * authored: `buildInboxTable` reads the payloads, decides what the columns are,
 * and hands the result to the same `TableRenderer` every other table uses. It is
 * the clearest demonstration that a document is data — the builder is a good way
 * to make one, not the only way.
 */
export function Inbox() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState(listSubmissions);

  const { schema } = useMemo(() => buildInboxTable(submissions), [submissions]);

  return (
    <Page
      title="Inbox"
      subtitle="Received submissions, rendered through a table document generated from them."
      extra={
        submissions.length > 0 ? (
          <Popconfirm
            title="Clear every submission?"
            onConfirm={() => {
              clearSubmissions();
              setSubmissions([]);
              message.success('Inbox cleared');
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Clear
            </Button>
          </Popconfirm>
        ) : null
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="This table was generated, not drawn"
          description={
            <Typography.Text style={{ fontSize: 13 }}>
              The columns come from the payload keys these submissions actually carry, and the
              formats are inferred from the values. It still goes through <code>parseTableSchema</code>{' '}
              and renders through the same component as the authored tables.
            </Typography.Text>
          }
        />

        <Card size="small">
          {submissions.length === 0 ? (
            <Empty description="Nothing received yet — fill in a form or run a flow" />
          ) : (
            <TableRenderer
              schema={schema}
              onSelectionChange={(keys) => {
                // One row picked opens it; the renderer reports selection, the
                // host decides what selection means.
                if (keys.length === 1) navigate(`/submissions/${String(keys[0])}`);
              }}
            />
          )}
        </Card>
      </Space>
    </Page>
  );
}
