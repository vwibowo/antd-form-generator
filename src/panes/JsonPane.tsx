import { Alert, Button, Card, Input, Space, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseFormSchema } from '@/schema/schema';
import { parseTableSchema } from '@/schema/table';
import { parseWorkflowSchema } from '@/schema/workflow';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useTableStore } from '@/store/useTableStore';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/** What a pane needs to edit one document as text. */
export interface JsonEditorProps<T> {
  title: string;
  document: T;
  parse: (input: unknown) => { ok: true; schema: T } | { ok: false; errors: string[] };
  onApply: (schema: T) => void;
}

/**
 * Two-way JSON view. Typing valid JSON pushes it into the store; invalid JSON
 * shows errors and leaves the store untouched, so a half-typed edit never
 * destroys the document being built.
 *
 * Generic over the document so the form and the table share one editor — only
 * the validator and the store binding differ.
 */
export function JsonEditor<T>({ title, document, parse, onApply }: JsonEditorProps<T>) {
  const serialized = useMemo(() => JSON.stringify(document, null, 2), [document]);
  const [draft, setDraft] = useState(serialized);
  const [errors, setErrors] = useState<string[]>([]);
  const focusedRef = useRef(false);

  // Pull store changes in only while the user is not typing, so builder edits
  // show up here without clobbering an in-progress edit.
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(serialized);
      setErrors([]);
    }
  }, [serialized]);

  const apply = (next: string) => {
    setDraft(next);
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Invalid JSON']);
      return;
    }
    const result = parse(parsed);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (JSON.stringify(result.schema) !== serialized) {
      onApply(result.schema);
    }
  };

  return (
    <div style={{ padding: 16, height: 'calc(100vh - 100px)' }}>
      <Card
        size="small"
        title={title}
        extra={
          <Space>
            <Button
              size="small"
              onClick={() => {
                try {
                  setDraft(JSON.stringify(JSON.parse(draft), null, 2));
                  setErrors([]);
                } catch {
                  setErrors(['Cannot format — fix the JSON syntax first']);
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
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Edits here apply to the builder as soon as the JSON is valid.
        </Typography.Paragraph>

        {errors.length > 0 ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            title={`${errors.length} problem${errors.length > 1 ? 's' : ''} — changes not applied`}
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {errors.slice(0, 10).map((error) => (
                  <li key={error} style={{ fontSize: 12 }}>
                    {error}
                  </li>
                ))}
              </ul>
            }
          />
        ) : null}

        <Input.TextArea
          data-testid="json-editor"
          value={draft}
          onChange={(event) => apply(event.target.value)}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            setDraft(serialized);
            setErrors([]);
          }}
          autoSize={{ minRows: 24, maxRows: 40 }}
          spellCheck={false}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
        />
      </Card>
    </div>
  );
}

export function JsonPane() {
  const schema = useSchemaStore((state) => state.schema);
  const setSchema = useSchemaStore((state) => state.setSchema);

  return (
    <JsonEditor
      title="Form schema JSON"
      document={schema}
      parse={parseFormSchema}
      onApply={setSchema}
    />
  );
}

export function TableJsonPane() {
  const schema = useTableStore((state) => state.schema);
  const setSchema = useTableStore((state) => state.setSchema);

  return (
    <JsonEditor
      title="Table schema JSON"
      document={schema}
      parse={parseTableSchema}
      onApply={setSchema}
    />
  );
}

export function WorkflowJsonPane() {
  const schema = useWorkflowStore((state) => state.schema);
  const setSchema = useWorkflowStore((state) => state.setSchema);

  return (
    <JsonEditor
      title="Workflow schema JSON"
      document={schema}
      parse={parseWorkflowSchema}
      onApply={setSchema}
    />
  );
}
