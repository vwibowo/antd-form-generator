import { Alert, Button, Card, Input, Space, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseFormSchema } from '@/schema/schema';
import { useSchemaStore } from '@/store/useSchemaStore';

/**
 * Two-way JSON view. Typing valid JSON pushes it into the store; invalid JSON
 * shows errors and leaves the store untouched, so a half-typed edit never
 * destroys the form being built.
 */
export function JsonPane() {
  const schema = useSchemaStore((state) => state.schema);
  const setSchema = useSchemaStore((state) => state.setSchema);

  const serialized = useMemo(() => JSON.stringify(schema, null, 2), [schema]);
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
    const result = parseFormSchema(parsed);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (JSON.stringify(result.schema) !== serialized) {
      setSchema(result.schema);
    }
  };

  return (
    <div style={{ padding: 16, height: "calc(100vh - 100px)" }}>
      <Card
        size="small"
        title="Form schema JSON"
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
