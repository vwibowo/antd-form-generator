import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Card, Empty, List, Popconfirm, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import type { LibraryDocument } from '../lib/documentLibrary';
import { listDocuments, removeDocument, resetLibrary } from '../lib/documentLibrary';
import { Page } from '../layout/Page';

const KIND_COLOUR = { screen: 'blue', table: 'green', workflow: 'purple' } as const;

function openPath(entry: LibraryDocument): string {
  if (entry.kind === 'table') return `/tables/${entry.id}`;
  if (entry.kind === 'workflow') return `/flows/${entry.id}`;
  return `/forms/${entry.id}`;
}

/** Every document the console can render, and where each one leads. */
export function Library() {
  const { message } = App.useApp();
  const [documents, setDocuments] = useState(listDocuments);

  return (
    <Page
      title="Documents"
      subtitle="Each of these is JSON. The console renders it; nothing here is a hand-written page."
      extra={
        <Popconfirm
          title="Reset to the samples?"
          description="Anything published from the builder is discarded."
          onConfirm={() => {
            resetLibrary();
            setDocuments(listDocuments());
            message.success('Library reset');
          }}
        >
          <Button size="small" icon={<ReloadOutlined />}>
            Reset
          </Button>
        </Popconfirm>
      }
    >
      <Card size="small">
        {documents.length === 0 ? (
          <Empty description="No documents" />
        ) : (
          <List
            dataSource={documents}
            renderItem={(entry) => (
              <List.Item
                actions={[
                  <Link key="open" to={openPath(entry)}>
                    {entry.kind === 'workflow' ? 'Run' : entry.kind === 'table' ? 'View' : 'Fill in'}
                  </Link>,
                  <Popconfirm
                    key="remove"
                    title="Remove from the library?"
                    onConfirm={() => {
                      setDocuments(removeDocument(entry.id));
                      message.success('Removed');
                    }}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={8}>
                      <Link to={openPath(entry)}>{entry.title}</Link>
                      <Tag color={KIND_COLOUR[entry.kind]}>{entry.kind}</Tag>
                      {entry.source !== 'sample' ? <Tag>{entry.source}</Tag> : null}
                    </Space>
                  }
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {entry.description || 'No description'}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Page>
  );
}
