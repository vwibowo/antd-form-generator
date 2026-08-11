import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useRef, useState } from 'react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { NODE_HEIGHT, NODE_WIDTH } from './edgeGeometry';
import type { ActiveDrag, WorkflowDragData } from './dndTypes';
import { WF_STAGE_ID } from './dndTypes';
import { FormNodeEditor } from './FormNodeEditor';
import { GraphCanvas } from './GraphCanvas';
import { GraphOverlay } from './GraphOverlay';
import { NodePalette } from './NodePalette';
import { PageNodeEditor } from './PageNodeEditor';
import { WorkflowInspector } from './WorkflowInspector';

/**
 * Pointer position decides the target, falling back to rectangle overlap when
 * the cursor is over nothing.
 *
 * The stage droppable spans the whole canvas, so it matches on every drag and
 * would win ties against the node the pointer is actually over — the same
 * problem a container card causes in the form builder, solved the same way.
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
  if (collisions.length < 2) return collisions;

  const specific = collisions.filter((collision) => collision.id !== WF_STAGE_ID);
  return specific.length > 0 ? specific : collisions;
};

/**
 * The workflow builder: node palette on the left, graph in the middle, the
 * selected node or branch on the right.
 *
 * It owns its own `DndContext`, like `TableBuilder` does — and when a form
 * node's fields are being edited it renders the form builder *instead of*
 * itself, so the two contexts are never mounted at the same time.
 */
export function WorkflowBuilder() {
  const schema = useWorkflowStore((state) => state.schema);
  const addNode = useWorkflowStore((state) => state.addNode);
  const moveNode = useWorkflowStore((state) => state.moveNode);
  const addEdge = useWorkflowStore((state) => state.addEdge);

  const stageRef = useRef<HTMLDivElement | null>(null);
  /** What is being dragged, for the live branches and the rubber band. */
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  /** Set while a form node's fields are being edited; null shows the graph. */
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  /** The same, for a page node's blocks. */
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  const sensors = useSensors(
    // Matches the form canvas: a small distance so a click still selects.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const editingNode = useMemo(
    () => schema.nodes.find((node) => node.id === editingFormId) ?? null,
    [schema.nodes, editingFormId],
  );

  const editingPageNode = useMemo(
    () => schema.nodes.find((node) => node.id === editingPageId) ?? null,
    [schema.nodes, editingPageId],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as WorkflowDragData | undefined;
    // A palette drag moves nothing that is already on the canvas, so it needs
    // no live offset at all.
    if (data?.source === 'wf-port') {
      setDrag({ kind: 'port', id: data.from, dx: 0, dy: 0 });
    } else if (data?.source === 'wf-node') {
      setDrag({ kind: 'node', id: data.id, dx: 0, dy: 0 });
    }
  };

  /**
   * The browser already coalesces `pointermove` to about one per frame, and the
   * only thing that re-renders here is the edge layer — a dozen bezier strings.
   * So this updates on every move rather than batching into a frame of its own.
   *
   * The functional form matters: a move can arrive before React has re-rendered
   * with what `onDragStart` set, and reading `drag` from this closure would
   * drop it. Returning `current` unchanged when nothing is being dragged keeps
   * React from re-rendering at all.
   */
  const handleDragMove = (event: DragMoveEvent) => {
    setDrag((current) =>
      current ? { ...current, dx: event.delta.x, dy: event.delta.y } : current,
    );
  };

  const clearDrag = () => setDrag(null);

  const handleDragEnd = (event: DragEndEvent) => {
    clearDrag();
    const { active, over, delta } = event;
    const activeData = active.data.current as WorkflowDragData | undefined;
    const overData = over?.data.current as WorkflowDragData | undefined;
    if (!activeData) return;

    if (activeData.source === 'wf-port') {
      // A branch only means something when it lands on a node.
      if (overData?.source === 'wf-node-drop' && overData.id !== activeData.from) {
        addEdge(activeData.from, overData.id);
      }
      return;
    }

    if (activeData.source === 'wf-node') {
      const node = schema.nodes.find((entry) => entry.id === activeData.id);
      if (!node) return;
      moveNode(node.id, node.x + delta.x, node.y + delta.y);
      return;
    }

    if (activeData.source === 'wf-palette') {
      const stage = stageRef.current;
      const rect = active.rect.current.translated;
      if (!stage || !rect) {
        addNode(activeData.kind);
        return;
      }
      // The drag overlay is a palette-sized pill, so its top-left is not where
      // the node card's would be; centring the drop under the pointer is what
      // makes the node appear where it was released.
      const bounds = stage.getBoundingClientRect();
      const x = rect.left - bounds.left + stage.scrollLeft - (NODE_WIDTH - rect.width) / 2;
      const y = rect.top - bounds.top + stage.scrollTop - (NODE_HEIGHT - rect.height) / 2;
      addNode(activeData.kind, { x: Math.max(0, x), y: Math.max(0, y) });
    }
  };

  // Either editor replaces the graph rather than nesting inside it, so the two
  // `DndContext`s are never mounted at the same time.
  if (editingNode) {
    return (
      <FormNodeEditor
        key={editingNode.id}
        node={editingNode}
        onBack={() => setEditingFormId(null)}
      />
    );
  }

  if (editingPageNode) {
    return (
      <PageNodeEditor
        key={editingPageNode.id}
        node={editingPageNode}
        onBack={() => setEditingPageId(null)}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragCancel={clearDrag}
      onDragEnd={handleDragEnd}
    >
      <div className="fg-builder fg-builder--workflow">
        <aside className="fg-builder__palette fg-scroll">
          <div>
            <NodePalette />
          </div>
        </aside>

        <main style={{ minWidth: 0, height: '100%' }} className="fg-builder__main">
          <GraphCanvas stageRef={stageRef} drag={drag} />
          <GraphOverlay />
        </main>

        <aside className="fg-builder__inspector">
          <WorkflowInspector onEditForm={setEditingFormId} onEditPage={setEditingPageId} />
        </aside>
      </div>
    </DndContext>
  );
}
