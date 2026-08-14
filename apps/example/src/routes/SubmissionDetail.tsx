import type { ScreenSchema } from '@antd-form-generator/core';
import { SummaryRenderer } from '@antd-form-generator/core';
import { Card, Col, Result, Row, Space, Tag, Typography } from 'antd';
import { Link, useParams } from 'react-router';
import { getDocument } from '../lib/documentLibrary';
import { getSubmission } from '../lib/submissions';
import { Page } from '../layout/Page';

/**
 * One received submission, read back through the document it came from.
 *
 * `SummaryRenderer` takes the same schema the form used and the payload that
 * form produced, and lays it out read-only. That round trip is the part worth
 * watching: a date left as an ISO string and comes back formatted, and a custom
 * component's reshaped value is read back through its `deserialize` hook.
 *
 * A workflow's payload is spread over several screens, so there is no single
 * document to lay it out with — those get the raw payload instead, which is an
 * honest answer rather than a wrong summary.
 */
export function SubmissionDetail() {
  const { id = '' } = useParams();
  const submission = getSubmission(id);
  const document = submission ? getDocument(submission.documentId) : undefined;

  if (!submission) {
    return (
      <Page title="Not found">
        <Result
          status="404"
          title="No such submission"
          extra={<Link to="/submissions">Back to the inbox</Link>}
        />
      </Page>
    );
  }

  const summarisable = document?.kind === 'screen';

  return (
    <Page
      title={submission.documentTitle}
      subtitle={`Received ${new Date(submission.submittedAt).toLocaleString()}`}
      extra={<Tag color={submission.kind === 'workflow' ? 'purple' : 'blue'}>{submission.kind}</Tag>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card size="small" title={summarisable ? 'Summary' : 'What the run collected'}>
            {summarisable ? (
              <SummaryRenderer
                schema={document.schema as ScreenSchema}
                values={submission.payload}
              />
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                A flow's answers come from several screens, so there is no single document to lay
                them out with. The payload is beside this.
              </Typography.Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title="Payload">
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(submission.payload, null, 2)}
              </pre>
            </Card>

            {submission.trace ? (
              <Card size="small" title="Route taken">
                <Space orientation="vertical" size={2}>
                  {submission.trace.map((nodeId, index) => (
                    <Typography.Text key={`${nodeId}-${index}`} style={{ fontSize: 12 }}>
                      {index + 1}. <code>{nodeId}</code>
                    </Typography.Text>
                  ))}
                </Space>
              </Card>
            ) : null}
          </Space>
        </Col>
      </Row>
    </Page>
  );
}
