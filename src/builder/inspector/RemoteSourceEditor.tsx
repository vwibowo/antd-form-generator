import { Alert, Checkbox, Input, InputNumber, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { extractDependencies } from '@/renderer/remote/url';
import type { DataSource, FieldNode } from '@/schema/schema';
import { remoteSearchSchema } from '@/schema/schema';
import { Labeled } from './Labeled';

export interface RemoteSourceEditorProps {
  node: FieldNode;
  source: DataSource;
  onChange: (source: DataSource) => void;
  /** Same list the condition editor uses, for spotting typo'd `{{names}}`. */
  fieldChoices: { label: string; value: string }[];
}

export function RemoteSourceEditor({
  node,
  source,
  onChange,
  fieldChoices,
}: RemoteSourceEditorProps) {
  const setSource = (patch: Partial<DataSource>) => onChange({ ...source, ...patch });

  const deps = useMemo(() => extractDependencies(source.url), [source.url]);
  const knownNames = useMemo(
    () => new Set(fieldChoices.map((choice) => choice.value)),
    [fieldChoices],
  );

  const search = source.search;
  const tagsMode = node.props?.mode === 'tags';

  return (
    <Space orientation="vertical" size={0} style={{ width: '100%' }}>
      <Labeled
        label="URL"
        help="Absolute http(s) URL. Use {{fieldName}} to insert another field's value."
      >
        <Input
          size="small"
          value={source.url}
          placeholder="https://api.example.com/items"
          onChange={(event) => setSource({ url: event.target.value })}
        />
      </Labeled>

      {deps.length > 0 ? (
        <div style={{ marginTop: -6, marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11, marginInlineEnd: 6 }}>
            Depends on
          </Typography.Text>
          {deps.map((dep) => (
            <Tag key={dep} color={knownNames.has(dep) ? undefined : 'red'}>
              {dep}
            </Tag>
          ))}
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            Red means no field with that name is in scope. This field stays disabled until
            every dependency has a value, and clears itself when one changes.
          </Typography.Text>
        </div>
      ) : null}

      <Labeled label="Response path" help="Leave blank if the response is the array itself.">
        <Input
          size="small"
          value={source.dataPath}
          placeholder="data.items"
          onChange={(event) => setSource({ dataPath: event.target.value })}
        />
      </Labeled>

      <Labeled label="Label key" help="Dot paths allowed, e.g. name.common.">
        <Input
          size="small"
          value={source.labelKey}
          placeholder="label"
          onChange={(event) => setSource({ labelKey: event.target.value })}
        />
      </Labeled>

      <Labeled
        label="Value key"
        help="Numeric API values stay numbers; a default value typed by hand is a string, and the two will not match."
      >
        <Input
          size="small"
          value={source.valueKey}
          placeholder="value"
          onChange={(event) => setSource({ valueKey: event.target.value })}
        />
      </Labeled>

      {node.type === 'select' ? (
        <>
          <Checkbox
            checked={!!search}
            onChange={(event) =>
              setSource({
                search: event.target.checked ? remoteSearchSchema.parse({}) : undefined,
              })
            }
            style={{ fontSize: 12, marginBottom: search ? 12 : 0 }}
          >
            Search on the server as the user types
          </Checkbox>

          {search ? (
            <>
              {tagsMode ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12, fontSize: 11 }}
                  message="Tags mode lets people submit values that are not in the list."
                />
              ) : null}

              <Labeled label="Search parameter">
                <Input
                  size="small"
                  value={search.param}
                  placeholder="q"
                  onChange={(event) => setSource({ search: { ...search, param: event.target.value } })}
                />
              </Labeled>

              <Labeled label="Debounce (ms)">
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  min={0}
                  max={5000}
                  value={search.debounceMs}
                  onChange={(value) =>
                    setSource({ search: { ...search, debounceMs: value ?? 300 } })
                  }
                />
              </Labeled>

              <Labeled
                label="Minimum characters"
                help="A saved value shows as its raw id until a search returns that item."
              >
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  min={0}
                  max={10}
                  value={search.minChars}
                  onChange={(value) => setSource({ search: { ...search, minChars: value ?? 0 } })}
                />
              </Labeled>
            </>
          ) : null}
        </>
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
          Server-side search is available on Select only.
        </Typography.Text>
      )}

      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 12 }}>
        Requests run in this browser, so the API must allow cross-origin reads. Do not put
        tokens in the URL — the schema is saved to localStorage and included in exports.
      </Typography.Text>
    </Space>
  );
}
