import type { WorkflowSchema } from '@antd-form-generator/core';
import { WorkflowRenderer } from '@antd-form-generator/core';
import { App, Result, Tag } from 'antd';
import { useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getDocument } from '../lib/documentLibrary';
import { addSubmission } from '../lib/submissions';
import { Page } from '../layout/Page';

/**
 * One workflow document, actually run.
 *
 * The interesting prop is `onAction`. An `action` node names something the host
 * is supposed to do — `account.open`, `oncall.page` — and the document carries
 * only the intent. Here that intent gets executed: the console pretends to call
 * a service, the run waits for it, and only then advances. That is the seam a
 * real integration would use, and without it the node is decorative.
 */
export function FlowRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const entry = getDocument(id);

  // `onComplete` can fire again if React re-runs the effect that reports it;
  // a run finishes once, so the submission is written once.
  const stored = useRef(false);

  if (!entry || entry.kind !== 'workflow') {
    return (
      <Page title="Not found">
        <Result
          status="404"
          title="No such flow"
          subTitle="It may have been removed from the library."
          extra={<Link to="/library">Back to documents</Link>}
        />
      </Page>
    );
  }

  return (
    <Page
      title={entry.title}
      subtitle={entry.description}
      extra={<Tag color="purple">workflow</Tag>}
    >
      <WorkflowRenderer
        schema={entry.schema as WorkflowSchema}
        onAction={async (action, node) => {
          // Stand-in for the real integration. The await is the point: the run
          // does not move until the work the document asked for has happened.
          message.loading({ content: `Running ${action.id || node.id}…`, key: 'wf-action' });
          await new Promise((resolve) => setTimeout(resolve, 600));
          message.success({ content: `${action.label || action.id || 'Done'}`, key: 'wf-action' });
        }}
        onComplete={(values, state) => {
          if (stored.current) return;
          stored.current = true;
          const saved = addSubmission({
            documentId: entry.id,
            documentTitle: entry.title,
            kind: 'workflow',
            payload: values,
            trace: state.trace,
          });
          message.success('Flow finished');
          navigate(`/submissions/${saved.id}`);
        }}
      />
    </Page>
  );
}
