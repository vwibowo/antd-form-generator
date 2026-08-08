import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Card } from 'antd';
import { TableRenderer } from '@/renderer/table/TableRenderer';
import { useTableStore } from '@/store/useTableStore';
import { ColumnInspector } from './ColumnInspector';
import { ColumnList } from './ColumnList';
import { TableDataPanel } from './TableDataPanel';

/**
 * The table builder: data source and columns on the left, the live table in the
 * middle, the selected column's settings on the right.
 *
 * It owns its own `DndContext` — the form builder is unmounted in table mode,
 * so the two never nest. Only the column list is sortable, so plain
 * `closestCenter` is enough; there are no nested drop targets to disambiguate
 * the way the form canvas has.
 */
export function TableBuilder() {
  const columns = useTableStore((state) => state.schema.columns);
  const schema = useTableStore((state) => state.schema);
  const moveColumn = useTableStore((state) => state.moveColumn);

  const sensors = useSensors(
    // Matches the canvas: a small distance so clicking the handle still selects.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const toIndex = columns.findIndex((column) => column.id === over.id);
    if (toIndex === -1) return;
    moveColumn(String(active.id), toIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="fg-builder fg-builder--table">
        <aside className="fg-builder__palette fg-scroll">
          <div>
            <TableDataPanel />
            <ColumnList />
          </div>
        </aside>

        <main style={{ minWidth: 0, height: '100%' }} className="fg-builder__main">
          <div className="fg-scroll" style={{ padding: 16 }}>
            <Card size="small" title="Preview">
              <TableRenderer schema={schema} />
            </Card>
          </div>
        </main>

        <aside className="fg-builder__inspector">
          <ColumnInspector />
        </aside>
      </div>
    </DndContext>
  );
}
