import { Alert, Card, Input, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

export interface JsonValuesEditorProps {
  title: string;
  help?: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

/**
 * A payload typed as JSON.
 *
 * Same contract the JSON tab has: invalid text lists its error and leaves the
 * last good value alone, so typing a half-finished object cannot blank the
 * thing you are previewing.
 */
export function JsonValuesEditor({ title, help, values, onChange }: JsonValuesEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(values, null, 2));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  // Only sync inward while the field is not being typed in, or every keystroke
  // would fight the reformat — the guard `JsonPane` uses.
  useEffect(() => {
    if (focused.current) return;
    setText(JSON.stringify(values, null, 2));
  }, [values]);

  const apply = (next: string) => {
    setText(next);
    if (next.trim() === '') {
      setError(null);
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(next);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError('A payload has to be a JSON object.');
        return;
      }
      setError(null);
      onChange(parsed as Record<string, unknown>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Not valid JSON');
    }
  };

  return (
    <Card size="small" title={title}>
      {help ? (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {help}
        </Typography.Paragraph>
      ) : null}

      {error ? (
        <Alert type="warning" showIcon title={error} style={{ marginBottom: 8 }} />
      ) : null}

      <Input.TextArea
        rows={16}
        value={text}
        spellCheck={false}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
        onChange={(event) => apply(event.target.value)}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
      />
    </Card>
  );
}
