import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { AutoComplete, Button, Checkbox, Input, InputNumber, Select, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { createId } from '@antd-form-generator/core/lib/ids';
import { formatCell } from '@antd-form-generator/core/renderer/table/cells';
import {
  CELL_FORMATS,
  collectRowPaths,
  tableActionSchema,
  type TableAction,
  type TableColumn,
} from '@antd-form-generator/core/schema/table';
import { specsForFormat, TABLE_PROP_SPECS } from '@antd-form-generator/core/schema/tablePropSpecs';
import { useTableStore } from '../store/useTableStore';
import { Labeled } from '../inspector/Labeled';
import { PropSection } from '../inspector/PropRow';
import { useSampleRows } from './useSampleRows';

/**
 * The right-hand panel: the selected column, or the table itself when nothing
 * is selected. Mirrors how the form inspector switches between a field and the
 * form settings.
 */
export function ColumnInspector() {
  const schema = useTableStore((state) => state.schema);
  const selectedId = useTableStore((state) => state.selectedColumnId);
  const column = schema.columns.find((entry) => entry.id === selectedId);

  return (
    <div className="fg-scroll" style={{ height: '100%' }}>
      {column ? <ColumnSettings column={column} /> : <TableSettings />}
    </div>
  );
}

function ColumnSettings({ column }: { column: TableColumn }) {
  const updateColumn = useTableStore((state) => state.updateColumn);
  const source = useTableStore((state) => state.schema.source);
  const serverPaging = source.kind === 'remote' && source.paging === 'server';
  const patch = (next: Partial<TableColumn>) => updateColumn(column.id, next);

  return (
    <>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(5, 5, 5, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Typography.Text strong style={{ fontSize: 13 }}>
          {column.title || 'Untitled column'}
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>{column.format}</Tag>
      </div>

      <div style={{ padding: 12 }}>
        <Labeled label="Header" help="What the reader sees at the top of the column.">
          <Input
            size="small"
            value={column.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Labeled>

        <FieldPicker column={column} onChange={(key) => patch({ key })} />

        <Labeled label="Value format">
          <Select
            size="small"
            style={{ width: '100%' }}
            value={column.format}
            options={CELL_FORMATS.map((format) => ({
              label: format.charAt(0).toUpperCase() + format.slice(1),
              value: format,
            }))}
            onChange={(format) => patch({ format })}
          />
        </Labeled>

        <Labeled label="Width (px)" help="Blank lets antd size the column.">
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            min={40}
            value={column.width}
            onChange={(width) => patch({ width: width ?? undefined })}
          />
        </Labeled>

        <Labeled label="Alignment">
          <Select
            size="small"
            style={{ width: '100%' }}
            value={column.align}
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Centre', value: 'center' },
              { label: 'Right', value: 'right' },
            ]}
            onChange={(align) => patch({ align })}
          />
        </Labeled>

        <Labeled label="Freeze" help="Keeps the column in view while scrolling sideways.">
          <Select
            size="small"
            style={{ width: '100%' }}
            value={column.fixed ?? ''}
            options={[
              { label: 'Not frozen', value: '' },
              { label: 'Left edge', value: 'left' },
              { label: 'Right edge', value: 'right' },
            ]}
            onChange={(fixed) => patch({ fixed: fixed === '' ? undefined : (fixed as 'left' | 'right') })}
          />
        </Labeled>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <Checkbox
            checked={column.sortable}
            onChange={(event) => patch({ sortable: event.target.checked })}
          >
            Sortable
          </Checkbox>
          <Checkbox
            checked={column.ellipsis}
            onChange={(event) => patch({ ellipsis: event.target.checked })}
          >
            Truncate
          </Checkbox>
          <Checkbox
            checked={column.filterable}
            onChange={(event) => patch({ filterable: event.target.checked })}
          >
            Filterable
          </Checkbox>
        </div>

        {column.filterable ? (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, display: 'block', marginBottom: 12 }}
          >
            The dropdown lists the values found in the loaded rows.
            {serverPaging ? ' Under server paging that is the current page only.' : ''}
          </Typography.Text>
        ) : null}

        {column.filterable && serverPaging ? (
          <Labeled label="Filter parameter" help="Blank sends the column's own field name.">
            <Input
              size="small"
              placeholder={column.key || 'field'}
              value={column.filterParam}
              onChange={(event) => patch({ filterParam: event.target.value })}
            />
          </Labeled>
        ) : null}

        <PropSection
          specs={specsForFormat(column.format)}
          context={column}
          props={column.props ?? {}}
          onChange={(props) => patch({ props })}
        />
      </div>
    </>
  );
}

/**
 * Which value in a row the column shows.
 *
 * A dot path has always worked; what was missing was seeing which ones exist.
 * The options come from the rows already loaded, so nested objects and the
 * first element of an array are picked rather than guessed at — and free text
 * still applies, because a document authored elsewhere may name a path this
 * particular sample happens not to contain.
 */
function FieldPicker({
  column,
  onChange,
}: {
  column: TableColumn;
  onChange: (key: string) => void;
}) {
  const schema = useTableStore((state) => state.schema);
  const { rows } = useSampleRows(schema);

  const paths = useMemo(() => collectRowPaths(rows), [rows]);

  const options = paths.map((entry) => ({
    value: entry.path,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>{entry.path}</span>
        <Typography.Text type="secondary" style={{ fontSize: 11, maxWidth: 120 }} ellipsis>
          {entry.container ? describeContainer(entry.sample) : formatCell(entry.sample, column)}
        </Typography.Text>
      </div>
    ),
  }));

  // The hint reuses the cell formatter, so what it promises is what renders.
  const match = paths.find((entry) => entry.path === column.key);
  const help =
    rows.length === 0
      ? 'Dot path into a row, e.g. `user.name`.'
      : match
        ? `Sample: ${match.container ? describeContainer(match.sample) : formatCell(match.sample, column)} · looks like ${match.format}`
        : column.key === ''
          ? 'Pick a value, or type a dot path.'
          : 'No value at this path in the loaded rows.';

  return (
    <Labeled
      label="Field"
      help={help}
      status={rows.length > 0 && column.key !== '' && !match ? 'warning' : undefined}
    >
      <AutoComplete
        size="small"
        style={{ width: '100%' }}
        value={column.key}
        options={options}
        placeholder="reviews.path"
        status={rows.length > 0 && column.key !== '' && !match ? 'warning' : undefined}
        filterOption={(input, option) => {
          // Reopening a box that already holds a complete path should offer
          // every path, not narrow the list down to the one already chosen.
          if (paths.some((entry) => entry.path === input)) return true;
          // Match on the path itself; the label is a node, so antd cannot.
          return String(option?.value ?? '')
            .toLowerCase()
            .includes(input.toLowerCase());
        }}
        onChange={(value) => onChange(value ?? '')}
      />
    </Labeled>
  );
}

/** `{3 keys}` / `[2 items]` — a container's shape, not its contents. */
function describeContainer(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
  }
  if (value && typeof value === 'object') {
    const count = Object.keys(value).length;
    return `{${count} key${count === 1 ? '' : 's'}}`;
  }
  return '';
}

function TableSettings() {
  const schema = useTableStore((state) => state.schema);
  const updateSettings = useTableStore((state) => state.updateSettings);

  return (
    <div style={{ padding: 12 }}>
      <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
        Table settings
      </Typography.Text>

      <Labeled label="Title">
        <Input
          size="small"
          value={schema.title ?? ''}
          onChange={(event) => updateSettings({ title: event.target.value || undefined })}
        />
      </Labeled>

      <Labeled label="Description">
        <Input.TextArea
          size="small"
          autoSize={{ minRows: 2, maxRows: 4 }}
          value={schema.description ?? ''}
          onChange={(event) => updateSettings({ description: event.target.value || undefined })}
        />
      </Labeled>

      <Labeled label="Row key" help="Dot path to a stable id. Blank uses the row position.">
        <Input
          size="small"
          placeholder="id"
          value={schema.rowKey}
          onChange={(event) => updateSettings({ rowKey: event.target.value })}
        />
      </Labeled>

      <PropSection
        specs={TABLE_PROP_SPECS}
        context={schema.props ?? {}}
        props={schema.props ?? {}}
        onChange={(props) => updateSettings({ props })}
      />

      <SearchSettings />
      <SelectionSettings />
    </div>
  );
}

/** Section heading matching the ones `PropSection` renders. */
function SectionHeading({ children }: { children: string }) {
  return (
    <Typography.Text
      type="secondary"
      style={{
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        display: 'block',
        margin: '4px 0 8px',
      }}
    >
      {children}
    </Typography.Text>
  );
}

function SearchSettings() {
  const schema = useTableStore((state) => state.schema);
  const updateSettings = useTableStore((state) => state.updateSettings);
  const search = schema.search;
  const serverPaging = schema.source.kind === 'remote' && schema.source.paging === 'server';
  const patch = (next: Partial<typeof search>) => updateSettings({ search: { ...search, ...next } });

  return (
    <>
      <SectionHeading>Search</SectionHeading>

      <Checkbox
        checked={search.enabled}
        onChange={(event) => patch({ enabled: event.target.checked })}
        style={{ marginBottom: 12 }}
      >
        Show a search box
      </Checkbox>

      {search.enabled ? (
        <>
          <Labeled label="Placeholder">
            <Input
              size="small"
              value={search.placeholder}
              onChange={(event) => patch({ placeholder: event.target.value })}
            />
          </Labeled>

          <Labeled label="Columns searched" help="Blank searches every visible column.">
            <Select
              size="small"
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              placeholder="All columns"
              value={search.columnIds}
              options={schema.columns.map((column) => ({
                label: column.title || column.key,
                value: column.id,
              }))}
              onChange={(columnIds) => patch({ columnIds })}
            />
          </Labeled>

          {serverPaging ? (
            <>
              <Labeled label="Query parameter" help="Carries the term to the API.">
                <Input
                  size="small"
                  value={search.param}
                  onChange={(event) => patch({ param: event.target.value })}
                />
              </Labeled>
              <Labeled label="Debounce (ms)" help="How long typing settles before a request.">
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  min={0}
                  max={5000}
                  step={50}
                  value={search.debounceMs}
                  onChange={(value) => patch({ debounceMs: value ?? 300 })}
                />
              </Labeled>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function SelectionSettings() {
  const schema = useTableStore((state) => state.schema);
  const updateSettings = useTableStore((state) => state.updateSettings);
  const selection = schema.selection;
  const patch = (next: Partial<typeof selection>) =>
    updateSettings({ selection: { ...selection, ...next } });

  const patchAction = (id: string, next: Partial<TableAction>) =>
    patch({
      actions: selection.actions.map((action) =>
        action.id === id ? { ...action, ...next } : action,
      ),
    });

  return (
    <>
      <SectionHeading>Selection</SectionHeading>

      <Checkbox
        checked={selection.enabled}
        onChange={(event) => patch({ enabled: event.target.checked })}
        style={{ marginBottom: 12 }}
      >
        Let rows be selected
      </Checkbox>

      {selection.enabled ? (
        <>
          <Labeled label="Pick">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={selection.type}
              options={[
                { label: 'Any number of rows', value: 'checkbox' },
                { label: 'One row only', value: 'radio' },
              ]}
              onChange={(type) => patch({ type })}
            />
          </Labeled>

          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <Checkbox
              checked={selection.preserveAcrossPages}
              onChange={(event) => patch({ preserveAcrossPages: event.target.checked })}
            >
              Keep across pages
            </Checkbox>
            <Checkbox
              checked={selection.fixed}
              onChange={(event) => patch({ fixed: event.target.checked })}
            >
              Freeze column
            </Checkbox>
            <Checkbox
              checked={selection.hideSelectAll}
              onChange={(event) => patch({ hideSelectAll: event.target.checked })}
              disabled={selection.type === 'radio'}
            >
              Hide select-all
            </Checkbox>
          </div>

          <SectionHeading>Bulk actions</SectionHeading>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, display: 'block', marginBottom: 8 }}
          >
            Buttons shown while rows are picked. The app embedding the table decides what each one
            does; the document only carries its name.
          </Typography.Text>

          {selection.actions.map((action) => (
            <div
              key={action.id}
              style={{
                border: '1px solid rgba(5, 5, 5, 0.1)',
                borderRadius: 8,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Input
                  size="small"
                  placeholder="Archive"
                  value={action.label}
                  onChange={(event) => patchAction(action.id, { label: event.target.value })}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Remove action"
                  onClick={() =>
                    patch({ actions: selection.actions.filter((entry) => entry.id !== action.id) })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber
                  size="small"
                  min={1}
                  style={{ width: 90 }}
                  prefix="min"
                  value={action.minSelected}
                  onChange={(value) => patchAction(action.id, { minSelected: value ?? 1 })}
                />
                <Checkbox
                  checked={action.danger}
                  onChange={(event) => patchAction(action.id, { danger: event.target.checked })}
                >
                  Destructive
                </Checkbox>
              </div>
            </div>
          ))}

          <Button
            type="dashed"
            block
            size="small"
            icon={<PlusOutlined />}
            onClick={() =>
              patch({
                actions: [
                  ...selection.actions,
                  tableActionSchema.parse({
                    id: createId('act'),
                    label: `Action ${selection.actions.length + 1}`,
                  }),
                ],
              })
            }
          >
            Add action
          </Button>
        </>
      ) : null}
    </>
  );
}
