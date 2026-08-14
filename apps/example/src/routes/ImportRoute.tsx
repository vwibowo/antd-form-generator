import { parseDocument, validateDocument } from '@antd-form-generator/core';
import { Alert, App, Button, Card, Col, Input, Row, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { saveDocument } from '../lib/documentLibrary';
import { Page } from '../layout/Page';

const PLACEHOLDER = `{
  "kind": "screen",
  "title": "Holiday request",
  "nodes": [
    { "id": "f1", "type": "date", "name": "startsOn", "label": "First day off" },
    { "id": "f2", "type": "number", "name": "days", "label": "Working days" }
  ]
}`;

/**
 * Paste a document in and see what the library makes of it.
 *
 * Two different checks, and the difference matters. `parseDocument` answers "is
 * this a document at all" — it dispatches on `kind`, migrates the two legacy
 * shapes, and fills defaults. `validateDocument` answers "is this document
 * sensible", which is a different and softer question: a duplicate field name or
 * an unreachable branch is a warning, not a parse failure.
 *
 * A host that accepts documents from anywhere needs both, which is why both are
 * exported and why this page shows them side by side.
 */
export function ImportRoute() {
  const [text, setText] = useState('');
  const navigate = useNavigate();
  const { message } = App.useApp();

  const parsed = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      return parseDocument(JSON.parse(trimmed));
    } catch (error) {
      return {
        ok: false as const,
        errors: [error instanceof Error ? error.message : 'Not valid JSON'],
      };
    }
  }, [text]);

  const diagnostics = useMemo(() => {
    if (!parsed?.ok) return null;
    return validateDocument(parsed.schema);
  }, [parsed]);

  const publish = () => {
    if (!parsed?.ok) return;
    const title =
      (parsed.schema as { title?: string }).title?.trim() || `Imported ${parsed.kind}`;
    const entry = {
      id: `import-${Date.now().toString(36)}`,
      kind: parsed.kind,
      title,
      description: 'Imported from JSON',
      source: 'import' as const,
      schema: parsed.schema,
    };
    saveDocument(entry);
    message.success(`Added “${title}”`);
    navigate('/library');
  };

  return (
    <Page
      title="Import"
      subtitle="Paste a document. It is parsed and checked the same way the library checks its own."
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="JSON"
            extra={
              <Space size={6}>
                <Button size="small" onClick={() => setText(PLACEHOLDER)}>
                  Example
                </Button>
                <Button size="small" onClick={() => setText('')}>
                  Clear
                </Button>
              </Space>
            }
          >
            <Input.TextArea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={PLACEHOLDER}
              autoSize={{ minRows: 18, maxRows: 30 }}
              spellCheck={false}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Card
              size="small"
              title="Parse"
              extra={
                parsed?.ok ? (
                  <Button size="small" type="primary" onClick={publish}>
                    Add to library
                  </Button>
                ) : null
              }
            >
              {!parsed ? (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Nothing pasted yet.
                </Typography.Text>
              ) : parsed.ok ? (
                <Space orientation="vertical" size={6}>
                  <Space size={8}>
                    <Tag color="green">valid</Tag>
                    <Tag>{parsed.kind}</Tag>
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Defaults have been filled in, and the two legacy shapes are migrated on the way
                    through — so an old export still imports.
                  </Typography.Text>
                </Space>
              ) : (
                <Alert
                  type="error"
                  showIcon
                  title="Not a document"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {parsed.errors.slice(0, 8).map((error) => (
                        <li key={error} style={{ fontSize: 12 }}>
                          {error}
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
            </Card>

            {diagnostics ? (
              <Card size="small" title="Checks">
                {diagnostics.diagnostics.length === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Nothing to flag.
                  </Typography.Text>
                ) : (
                  <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                    {diagnostics.diagnostics.map((entry, index) => (
                      <Space key={`${entry.code}-${index}`} size={8} align="start">
                        <Tag color={entry.level === 'error' ? 'red' : 'orange'}>{entry.level}</Tag>
                        <Typography.Text style={{ fontSize: 12 }}>{entry.message}</Typography.Text>
                      </Space>
                    ))}
                  </Space>
                )}
              </Card>
            ) : null}
          </Space>
        </Col>
      </Row>
    </Page>
  );
}
