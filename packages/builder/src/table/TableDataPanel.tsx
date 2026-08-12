import { Alert, Button, Input, Segmented, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { extractDependencies } from '@antd-form-generator/core/renderer/remote/url';
import { useTableStore } from '../store/useTableStore';
import { Labeled } from '../inspector/Labeled';
import { useSampleRows } from './useSampleRows';

/**
 * Where the rows come from — the left panel of the table builder.
 *
 * Static and remote both end in the same place: an array of objects the
 * columns read. "Detect columns" is what turns either into a table without
 * typing a single column by hand.
 */
export function TableDataPanel() {
  const schema = useTableStore((state) => state.schema);
  const updateSource = useTableStore((state) => state.updateSource);
  const setParams = useTableStore((state) => state.setParams);
  const detectColumns = useTableStore((state) => state.detectColumns);
  const source = schema.source;

  const { rows: sampleRows } = useSampleRows(schema);

  return (
    <div style={{ padding: 12 }}>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        Data
      </Typography.Text>

      <Segmented
        size="small"
        block
        style={{ margin: '8px 0 12px' }}
        value={source.kind}
        options={[
          { label: 'Inline', value: 'static' },
          { label: 'API', value: 'remote' },
        ]}
        onChange={(kind) => updateSource({ kind: kind as 'static' | 'remote' })}
      />

      {source.kind === 'static' ? <StaticRows /> : <RemoteRows />}

      {source.kind === 'remote' && extractDependencies(source.url).length > 0 ? (
        <Labeled label="Parameters" help="Values for the {{tokens}} in the URL.">
          {extractDependencies(source.url).map((token) => (
            <Input
              key={token}
              size="small"
              addonBefore={token}
              style={{ marginBottom: 6 }}
              value={schema.params[token] ?? ''}
              onChange={(event) => setParams({ ...schema.params, [token]: event.target.value })}
            />
          ))}
        </Labeled>
      ) : null}

      <Button
        block
        size="small"
        style={{ marginTop: 4 }}
        disabled={sampleRows.length === 0}
        onClick={() => detectColumns(sampleRows)}
      >
        Detect columns
      </Button>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
        {sampleRows.length > 0
          ? `Reads ${sampleRows.length} row${sampleRows.length === 1 ? '' : 's'} and replaces the column list.`
          : 'Load some rows first.'}
      </Typography.Text>
    </div>
  );
}

/** Inline rows, authored as a JSON array. */
function StaticRows() {
  const rows = useTableStore((state) => state.schema.source.rows);
  const updateSource = useTableStore((state) => state.updateSource);

  const serialized = JSON.stringify(rows, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Pull store changes in only while the user is not typing — same guard the
  // JSON tab uses, so an edit elsewhere cannot clobber a half-typed array.
  useEffect(() => {
    if (!focused) {
      setDraft(serialized);
      setError(null);
    }
  }, [serialized, focused]);

  const apply = (next: string) => {
    setDraft(next);
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Invalid JSON');
      return;
    }
    if (!Array.isArray(parsed)) {
      setError('Expected an array of objects');
      return;
    }
    setError(null);
    updateSource({
      rows: parsed.filter(
        (row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null && !Array.isArray(row),
      ),
    });
  };

  return (
    <Labeled label="Rows" help="A JSON array of objects.">
      {error ? (
        <Alert type="error" showIcon style={{ marginBottom: 8 }} title={error} />
      ) : null}
      <Input.TextArea
        value={draft}
        onChange={(event) => apply(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(serialized);
          setError(null);
        }}
        autoSize={{ minRows: 8, maxRows: 18 }}
        spellCheck={false}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}
      />
    </Labeled>
  );
}

/** A GET that returns a list, plus how to page through it. */
function RemoteRows() {
  const source = useTableStore((state) => state.schema.source);
  const updateSource = useTableStore((state) => state.updateSource);

  return (
    <>
      <Labeled label="URL" help="http(s) GET. `{{token}}` is filled from Parameters below.">
        <Input
          size="small"
          placeholder="https://dummyjson.com/products"
          value={source.url}
          onChange={(event) => updateSource({ url: event.target.value })}
        />
      </Labeled>

      <Labeled label="Response path" help="Dot path to the array. Blank = the response itself.">
        <Input
          size="small"
          placeholder="products"
          value={source.dataPath}
          onChange={(event) => updateSource({ dataPath: event.target.value })}
        />
      </Labeled>

      <Labeled label="Paging">
        <Segmented
          size="small"
          block
          value={source.paging}
          options={[
            { label: 'In browser', value: 'client' },
            { label: 'On server', value: 'server' },
          ]}
          onChange={(paging) => updateSource({ paging: paging as 'client' | 'server' })}
        />
      </Labeled>

      {source.paging === 'server' ? (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
            Every page change refetches. <Tag style={{ marginInlineEnd: 0 }}>limit</Tag>/
            <Tag style={{ marginInlineEnd: 0 }}>skip</Tag> APIs want an offset.
          </Typography.Text>

          <Labeled label="Page parameter sends">
            <Segmented
              size="small"
              block
              value={source.pageMode}
              options={[
                { label: 'Page number', value: 'page' },
                { label: 'Row offset', value: 'offset' },
              ]}
              onChange={(mode) => updateSource({ pageMode: mode as 'page' | 'offset' })}
            />
          </Labeled>

          <Labeled label="Page parameter">
            <Input
              size="small"
              value={source.pageParam}
              onChange={(event) => updateSource({ pageParam: event.target.value })}
            />
          </Labeled>

          <Labeled label="Page size parameter">
            <Input
              size="small"
              value={source.sizeParam}
              onChange={(event) => updateSource({ sizeParam: event.target.value })}
            />
          </Labeled>

          {source.pageMode === 'page' ? (
            <Labeled label="First page is">
              <Segmented
                size="small"
                block
                value={String(source.pageStart)}
                options={[
                  { label: '1', value: '1' },
                  { label: '0', value: '0' },
                ]}
                onChange={(value) => updateSource({ pageStart: Number(value) })}
              />
            </Labeled>
          ) : null}

          <Labeled label="Total path" help="Dot path to the row count, e.g. `total`.">
            <Input
              size="small"
              placeholder="total"
              value={source.totalPath}
              onChange={(event) => updateSource({ totalPath: event.target.value })}
            />
          </Labeled>

          <Labeled label="Sort parameter" help="Blank keeps sorting off for server paging.">
            <Input
              size="small"
              placeholder="sortBy"
              value={source.sortParam}
              onChange={(event) => updateSource({ sortParam: event.target.value })}
            />
          </Labeled>

          {source.sortParam ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <Labeled label="Order parameter">
                <Input
                  size="small"
                  value={source.orderParam}
                  onChange={(event) => updateSource({ orderParam: event.target.value })}
                />
              </Labeled>
              <Labeled label="Ascending">
                <Input
                  size="small"
                  value={source.ascValue}
                  onChange={(event) => updateSource({ ascValue: event.target.value })}
                />
              </Labeled>
              <Labeled label="Descending">
                <Input
                  size="small"
                  value={source.descValue}
                  onChange={(event) => updateSource({ descValue: event.target.value })}
                />
              </Labeled>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
