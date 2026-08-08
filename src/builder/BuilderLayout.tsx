import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Tag } from 'antd';
import { useState } from 'react';
import { metaFor } from '@/schema/registry';
import type { FieldType } from '@/schema/schema';
import { isContainerType } from '@/schema/schema';
import { ROOT_CONTAINER_ID } from '@/schema/walk';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useCustomComponents } from '@/renderer/custom';
import { Canvas } from './Canvas';
import { Inspector } from './inspector';
import { Palette, customSeed, paletteIcon } from './Palette';
import type { DragData } from './dndTypes';

interface ActiveDrag {
  label: string;
  type: FieldType;
}

/**
 * Pointer position decides the target, falling back to rectangle proximity
 * when the cursor is over nothing droppable.
 *
 * `closestCenter` alone compares the *dragged card's* centre against every
 * droppable, so dropping a full-width field into a nested container almost
 * never resolves to that container — the card's centre sits somewhere else
 * entirely. Pointer-based detection is what makes nested drops land.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  if (collisions.length < 2) return collisions;

  // A container's own card spans its children, so the pointer is inside both.
  // Drop the container from the running whenever something more specific —
  // one of its children, or its inner drop zone — also matched.
  const isContainerCard = (id: string | number) => {
    const data = args.droppableContainers.find((entry) => entry.id === id)?.data
      .current as DragData | undefined;
    return data?.source === 'field' && isContainerType(data.fieldType);
  };

  const specific = collisions.filter((collision) => !isContainerCard(collision.id));
  return specific.length > 0 ? specific : collisions;
};

/** Where a drop should land: which container, and at what index within it. */
function resolveDropTarget(over: DragData | undefined): { containerId: string; index: number } | null {
  if (!over) return null;
  if (over.source === 'container') {
    // Trailing drop zone — append.
    return { containerId: over.containerId, index: Number.MAX_SAFE_INTEGER };
  }
  if (over.source === 'field') {
    return { containerId: over.containerId, index: over.index };
  }
  return null;
}

export function BuilderLayout() {
  const addField = useSchemaStore((state) => state.addField);
  const moveField = useSchemaStore((state) => state.moveField);
  const customComponents = useCustomComponents();
  const [active, setActive] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps click-to-select working on the handle.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    if (data.source === 'palette') {
      const custom = data.componentKey ? customComponents[data.componentKey] : undefined;
      setActive({ label: custom?.label ?? metaFor(data.fieldType).label, type: data.fieldType });
    } else if (data.source === 'field') {
      setActive({ label: metaFor(data.fieldType).label, type: data.fieldType });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const { active: activeItem, over } = event;
    if (!over) return;

    const activeData = activeItem.data.current as DragData | undefined;
    const overData = over.data.current as DragData | undefined;

    // Dropping onto the canvas background with no resolvable target appends
    // to the root, which is the least surprising outcome.
    const target = resolveDropTarget(overData) ?? {
      containerId: ROOT_CONTAINER_ID,
      index: Number.MAX_SAFE_INTEGER,
    };

    if (activeData?.source === 'palette') {
      addField(
        activeData.fieldType,
        target.containerId,
        target.index,
        customSeed(
          activeData.componentKey,
          activeData.componentKey ? customComponents[activeData.componentKey] : undefined,
        ),
      );
      return;
    }

    if (activeData?.source === 'field') {
      if (activeItem.id === over.id) return;
      moveField(activeData.id, target.containerId, target.index);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragCancel={() => setActive(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="fg-builder">
        <aside className="fg-builder__palette fg-scroll">
          <Palette />
        </aside>

        <main style={{ minWidth: 0, height: '100%' }} className='fg-builder__main'>
          <Canvas />
        </main>

        <aside className="fg-builder__inspector">
          <Inspector />
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <Tag
            icon={paletteIcon(active.type)}
            color="blue"
            style={{ padding: '4px 10px', fontSize: 13 }}
          >
            {active.label}
          </Tag>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
