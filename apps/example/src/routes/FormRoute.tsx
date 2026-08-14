import type { ScreenSchema } from '@antd-form-generator/core';
import { ScreenRenderer } from '@antd-form-generator/core';
import { App, Card, Result } from 'antd';
import { Link, useNavigate, useParams } from 'react-router';
import { getDocument } from '../lib/documentLibrary';
import { addSubmission } from '../lib/submissions';
import { Page } from '../layout/Page';

/**
 * One screen document, filled in for real.
 *
 * The whole route is `ScreenRenderer` plus somewhere to put the answer. What
 * arrives in `onSubmit` is payload shape — JSON, dates already serialised — so
 * it goes straight into the store and straight back out again on the detail
 * page. No mapping layer, because there is nothing to map.
 */
export function FormRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const entry = getDocument(id);

  if (!entry || entry.kind !== 'screen') {
    return (
      <Page title="Not found">
        <Result
          status="404"
          title="No such form"
          subTitle="It may have been removed from the library."
          extra={<Link to="/library">Back to documents</Link>}
        />
      </Page>
    );
  }

  return (
    <Page title={entry.title} subtitle={entry.description}>
      <Card size="small">
        <ScreenRenderer
          schema={entry.schema as ScreenSchema}
          onSubmit={(payload) => {
            const saved = addSubmission({
              documentId: entry.id,
              documentTitle: entry.title,
              kind: 'screen',
              payload,
            });
            message.success('Sent');
            navigate(`/submissions/${saved.id}`);
          }}
          // A screen whose author used buttons instead of a submit row reports
          // through `onAction` — the id says which button, and the values come
          // with it, so both paths end in the same place.
          onAction={(actionId, payload) => {
            const saved = addSubmission({
              documentId: entry.id,
              documentTitle: entry.title,
              kind: 'screen',
              payload: { ...payload, action: actionId },
            });
            message.success(`Sent (${actionId})`);
            navigate(`/submissions/${saved.id}`);
          }}
        />
      </Card>
    </Page>
  );
}
