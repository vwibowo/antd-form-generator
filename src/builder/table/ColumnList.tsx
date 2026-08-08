import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Empty, Tooltip, Typography } from 'antd';
import type { CSSProperties } from 'react';
import type { TableColumn } from '@/schema/table';
import { useTableStore } from '@/store/useTableStore';

/**
 * The column list — rename by selecting a row, reorder by dragging one.
 *
 * The drag handle carries the listeners rather than the row, so clicking a
 * column still selects it. Same split as the form canvas.
 */
export function ColumnList() {
  const columns = useTableStore((state) => state.schema.columns);
  const addColumn = useTableStore((state) => state.addColumn);

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}
      >
        Columns
      </Typography.Text>

      <div style={{ display: 'grid', gap: 4, margin: '8px 0' }}>
        {columns.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                No columns yet
              </Typography.Text>
            }
            style={{ margin: '8px 0' }}
          />
        ) : null}

        <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
          {columns.map((column) => (
            <SortableColumn key={column.id} column={column} />
          ))}
        </SortableContext>
      </div>

      <Button type="dashed" block size="small" icon={<PlusOutlined />} onClick={addColumn}>
        Add column
      </Button>
    </div>
  );
}

function SortableColumn({ column }: { column: TableColumn }) {
  const selectedId = useTableStore((state) => state.selectedColumnId);
  const selectColumn = useTableStore((state) => state.selectColumn);
  const updateColumn = useTableStore((state) => state.updateColumn);
  const removeColumn = useTableStore((state) => state.removeColumn);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 6px',
    borderRadius: 8,
    border: `1px solid ${selectedId === column.id ? '#1677ff' : 'rgba(5, 5, 5, 0.1)'}`,
    background: selectedId === column.id ? 'rgba(22, 119, 255, 0.06)' : '#fff',
    opacity: isDragging ? 0.4 : 1,
    cursor: 'pointer',
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => selectColumn(column.id)}>
      <Button
        type="text"
        size="small"
        className="fg-node__handle"
        icon={<HolderOutlined />}
        aria-label={`Reorder ${column.title}`}
        onClick={(event) => event.stopPropagation()}
        {...listeners}
        {...attributes}
      />

      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography.Text
          style={{ fontSize: 12, display: 'block' }}
          ellipsis
          delete={column.hidden}
        >
          {column.title || 'Untitled'}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 10 }} ellipsis>
          {column.key || 'no field'} · {column.format}
        </Typography.Text>
      </div>

      <Tooltip title={column.hidden ? 'Show' : 'Hide'}>
        <Button
          type="text"
          size="small"
          icon={column.hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          aria-label={column.hidden ? 'Show column' : 'Hide column'}
          onClick={(event) => {
            event.stopPropagation();
            updateColumn(column.id, { hidden: !column.hidden });
          }}
        />
      </Tooltip>

      <Button
        type="text"
        danger
        size="small"
        icon={<DeleteOutlined />}
        aria-label="Remove column"
        onClick={(event) => {
          event.stopPropagation();
          removeColumn(column.id);
        }}
      />
    </div>
  );
}
