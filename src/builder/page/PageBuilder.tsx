import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Tag } from 'antd';
import { useState } from 'react';
import type { PageBlockType } from '@/schema/page';
import { pageBlockMetaFor } from '@/schema/pageRegistry';
import type { FormSchema } from '@/schema/schema';
import { usePageBuilderStore } from '@/store/PageStoreContext';
import { BlockInspector } from './BlockInspector';
import { BlockPalette, blockIcon } from './BlockPalette';
import type { PageDragData } from './dndTypes';
import { PageCanvas } from './PageCanvas';

export interface PageBuilderProps {
  /** Payload keys a block condition can test. Empty for a standalone page. */
  fieldChoices?: { label: string; value: string }[];
  /** Form steps a `summary` block can lay out, when inside a workflow. */
  formSources?: Record<string, FormSchema>;
  formLabels?: Record<string, string>;
}

/**
 * The page builder: block palette, canvas, inspector.
 *
 * It owns its own `DndContext`, like `TableBuilder` and `WorkflowBuilder` do.
 * `closestCenter` is enough here where the form canvas needs pointer-priority
 * detection: a page has no containers, so there is no nested drop target to
 * resolve against and nothing to de-prioritise.
 */
export function PageBuilder({
  fieldChoices,
  formSources,
  formLabels,
}: PageBuilderProps) {
  const addBlock = usePageBuilderStore((state) => state.addBlock);
  const moveBlock = usePageBuilderStore((state) => state.moveBlock);
  const blocks = usePageBuilderStore((state) => state.schema.blocks);
  const [active, setActive] = useState<PageBlockType | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps click-to-select working on the handle.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as PageDragData | undefined;
    if (data?.source === 'page-palette') setActive(data.blockType);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const { active: activeItem, over } = event;
    if (!over) return;

    const activeData = activeItem.data.current as PageDragData | undefined;
    const overData = over.data.current as PageDragData | undefined;
    if (!activeData) return;

    // Dropping on the trailing zone means append; on a block means take its
    // place. Anything unresolvable appends, which is the least surprising.
    const index =
      overData?.source === 'page-block' ? overData.index : blocks.length;

    if (activeData.source === 'page-palette') {
      addBlock(activeData.blockType, index);
      return;
    }

    if (activeData.source === 'page-block') {
      if (activeItem.id === over.id) return;
      moveBlock(activeData.id, index);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActive(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="fg-builder">
        <aside className="fg-builder__palette fg-scroll">
          <div>
            <BlockPalette />
          </div>
        </aside>

        <main style={{ minWidth: 0, height: '100%' }} className="fg-builder__main">
          <PageCanvas formSources={formSources} />
        </main>

        <aside className="fg-builder__inspector">
          <BlockInspector
            fieldChoices={fieldChoices}
            formSources={formSources}
            formLabels={formLabels}
          />
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <Tag icon={blockIcon(active)} color="blue" style={{ padding: '4px 10px', fontSize: 13 }}>
            {pageBlockMetaFor(active).label}
          </Tag>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
