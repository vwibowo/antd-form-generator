import { Checkbox, Input, InputNumber, Select, Tag, Typography } from 'antd';
import { CELL_FORMATS, type TableColumn } from '@/schema/table';
import { specsForFormat, TABLE_PROP_SPECS } from '@/schema/tablePropSpecs';
import { useTableStore } from '@/store/useTableStore';
import { Labeled } from '../inspector/Labeled';
import { PropSection } from '../inspector/PropRow';

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

        <Labeled label="Field" help="Dot path into a row, e.g. `user.name`.">
          <Input
            size="small"
            value={column.key}
            onChange={(event) => patch({ key: event.target.value })}
          />
        </Labeled>

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

        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
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
        </div>

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
    </div>
  );
}
