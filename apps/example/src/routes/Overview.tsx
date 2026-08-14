import {
  ApartmentOutlined,
  DatabaseOutlined,
  FormOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { Alert, Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import { Link } from 'react-router';
import { listDocuments } from '../lib/documentLibrary';
import { listSubmissions } from '../lib/submissions';
import { Page } from '../layout/Page';

/**
 * What this console is, and what is in it right now.
 *
 * Every number here is counted from the same two stores the rest of the app
 * reads, so an empty demo says so rather than showing invented figures.
 */
export function Overview() {
  const documents = listDocuments();
  const submissions = listSubmissions();

  const byKind = {
    screen: documents.filter((entry) => entry.kind === 'screen').length,
    table: documents.filter((entry) => entry.kind === 'table').length,
    workflow: documents.filter((entry) => entry.kind === 'workflow').length,
  };

  return (
    <Page
      title="Meridian Ops"
      subtitle="An internal console where every page below is a JSON document rendered at runtime."
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="Nothing here is hand-built UI"
          description={
            <Typography.Text style={{ fontSize: 13 }}>
              Forms, tables and multi-step flows are all documents. Draw one in the{' '}
              <Link to="/builder">Builder</Link>, publish it, and it becomes a working page in this
              console — no deploy, no code. Requests run against an offline stub by default; see{' '}
              <Link to="/settings">Settings</Link>.
            </Typography.Text>
          }
        />

        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Forms" value={byKind.screen} prefix={<FormOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Data views" value={byKind.table} prefix={<DatabaseOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Flows" value={byKind.workflow} prefix={<ApartmentOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Received" value={submissions.length} prefix={<InboxOutlined />} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="Start something">
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {documents
                  .filter((entry) => entry.kind !== 'table')
                  .slice(0, 5)
                  .map((entry) => (
                    <div key={entry.id}>
                      <Link to={entry.kind === 'workflow' ? `/flows/${entry.id}` : `/forms/${entry.id}`}>
                        {entry.title}
                      </Link>{' '}
                      <Tag color={entry.kind === 'workflow' ? 'purple' : 'blue'}>{entry.kind}</Tag>
                      <Typography.Paragraph
                        type="secondary"
                        style={{ fontSize: 12, margin: 0 }}
                        ellipsis={{ rows: 2 }}
                      >
                        {entry.description}
                      </Typography.Paragraph>
                    </div>
                  ))}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card size="small" title="Recently received">
              {submissions.length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Nothing yet. Fill in a form or run a flow and it lands in the{' '}
                  <Link to="/submissions">Inbox</Link>.
                </Typography.Text>
              ) : (
                <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                  {submissions.slice(0, 5).map((entry) => (
                    <div key={entry.id}>
                      <Link to={`/submissions/${entry.id}`}>{entry.documentTitle}</Link>{' '}
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(entry.submittedAt).toLocaleString()}
                      </Typography.Text>
                    </div>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </Page>
  );
}
