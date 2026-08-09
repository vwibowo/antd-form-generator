import { Alert, Button, Card, Col, Input, Row, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useCustomComponents } from '@/renderer/custom';
import { buildInitialValues, collectPayloadKeys } from '@/renderer/initialValues';
import { serializeValues } from '@/renderer/serialize';
import { SummaryRenderer } from '@/renderer/summary/SummaryRenderer';
import type { FormSchema } from '@/schema/schema';
import { useSummaryStore } from '@/store/useSummaryStore';

export interface SummaryPaneProps {
  schema: FormSchema;
}

/**
 * Prefill a payload, see the summary page it produces.
 *
 * The values are edited as JSON rather than by filling the form in: a summary
 * has to be checkable against values the form itself would never produce
 * easily — a half-filled draft, a condition-hidden branch, ten list rows.
 */
export function SummaryPane({ schema }: SummaryPaneProps) {
  const draft = useSummaryStore((state) => state.draft);
  const setDraft = useSummaryStore((state) => state.setDraft);
  const registry = useCustomComponents();

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  // Invalid JSON leaves `values` alone, so the summary stays on screen while
  // the text is mid-edit rather than blanking on every keystroke.
  useEffect(() => {
    const text = draft.trim();
    if (text === '') {
      setValues({});
      setError(null);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('Values must be a JSON object, e.g. { "title": "Laptop" }');
      return;
    }
    setValues(parsed as Record<string, unknown>);
    setError(null);
  }, [draft]);

  // Keys the schema cannot produce — a hint that a name was renamed or typoed,
  // not a reason to stop rendering.
  const strayKeys = useMemo(() => {
    const known = collectPayloadKeys(schema);
    return Object.keys(values).filter((key) => !known.has(key));
  }, [schema, values]);

  const loadDefaults = () => {
    // `buildInitialValues` yields dayjs objects for dates; running them through
    // the submit-time serializer is what makes them JSON in the first place.
    const seeded = serializeValues(schema, buildInitialValues(schema), registry);
    setDraft(JSON.stringify(seeded, null, 2));
  };

  return (
    <Row gutter={16} style={{ padding: 16, height: 'calc(100vh - 100px)' }}>
      <Col xs={24} lg={10} style={{ height: '100%', overflow: 'auto' }}>
        <Card
          size="small"
          title="Values"
          extra={
            <Space>
              <Button size="small" onClick={loadDefaults}>
                Load defaults
              </Button>
              <Button
                size="small"
                onClick={() => {
                  try {
                    setDraft(JSON.stringify(JSON.parse(draft), null, 2));
                  } catch {
                    setError('Cannot format — fix the JSON syntax first');
                  }
                }}
              >
                Format
              </Button>
              <Button
                size="small"
                onClick={async () => {
                  await navigator.clipboard.writeText(draft);
                }}
              >
                Copy
              </Button>
              <Button size="small" onClick={() => setDraft('')}>
                Clear
              </Button>
            </Space>
          }
        >
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            The payload to summarise — the same shape the Preview tab submits.
          </Typography.Paragraph>

          {error ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              title="Invalid JSON — showing the last valid values"
              description={<span style={{ fontSize: 12 }}>{error}</span>}
            />
          ) : null}

          {!error && strayKeys.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              title={`${strayKeys.length} unused key${strayKeys.length > 1 ? 's' : ''}`}
              description={
                <span style={{ fontSize: 12 }}>
                  {strayKeys.slice(0, 10).join(', ')} — no field in this schema renders{' '}
                  {strayKeys.length > 1 ? 'them' : 'it'}.
                </span>
              }
            />
          ) : null}

          <Input.TextArea
            data-testid="summary-values"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={'{\n  "title": "New laptop"\n}'}
            autoSize={{ minRows: 20, maxRows: 36 }}
            spellCheck={false}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
          />
        </Card>
      </Col>

      <Col xs={24} lg={14} style={{ height: '100%', overflow: 'auto' }}>
        <Card size="small" title="Summary">
          <SummaryRenderer schema={schema} values={values} />
        </Card>
      </Col>
    </Row>
  );
}
