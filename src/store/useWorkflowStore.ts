import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PageSchema } from '@/schema/page';
import type { FormSchema } from '@/schema/schema';
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowSchema,
} from '@/schema/workflow';
import { createEmptyWorkflowSchema, parseWorkflowSchema } from '@/schema/workflow';
import {
  createWorkflowEdge,
  createWorkflowNode,
  duplicateWorkflowNode,
} from '@/schema/workflowFactory';
import { popHistory, pushHistory } from './history';

const STORAGE_KEY = 'antd-form-generator:workflow';

/** Canvas grid. Node positions are rounded to it so drops always line up. */
export const GRID = 16;

/**
 * How long a burst of edits carrying the same tag folds into one undo step.
 *
 * This exists for the embedded form editor: without it, typing a field label
 * inside a `form` node would push a whole-workflow snapshot per keystroke and
 * flush the 50-entry history in seconds.
 */
const COALESCE_MS = 600;

export interface WorkflowState {
  schema: WorkflowSchema;
  /** Mutually exclusive with `selectedEdgeId` — the inspector shows one thing. */
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  past: WorkflowSchema[];
  future: WorkflowSchema[];

  setSchema: (schema: WorkflowSchema) => void;
  updateSettings: (patch: Partial<WorkflowSchema>) => void;

  addNode: (kind: WorkflowNodeKind, at?: { x: number; y: number }) => void;
  updateNode: (id: string, patch: Partial<WorkflowNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  duplicateNode: (id: string) => void;
  removeNode: (id: string) => void;
  /** Replace one node's embedded form — the seam the form builder writes through. */
  setNodeForm: (id: string, form: FormSchema) => void;
  /** Replace one node's embedded page — the seam the page builder writes through. */
  setNodePage: (id: string, page: PageSchema) => void;
  /** Reposition many nodes at once — the seam auto-arrange writes through. */
  setNodePositions: (positions: Record<string, { x: number; y: number }>) => void;

  addEdge: (from: string, to: string) => void;
  updateEdge: (id: string, patch: Partial<WorkflowEdge>) => void;
  removeEdge: (id: string) => void;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

const snap = (value: number) => Math.round(value / GRID) * GRID;

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => {
      // Module-level would leak between hot reloads; closure-level ties the
      // coalescing window to this store instance.
      let lastTag: string | null = null;
      let lastTagAt = 0;

      /**
       * Apply a mutation to a cloned document and push the previous one.
       *
       * `tag` coalesces consecutive edits from one source into a single undo
       * step — see `COALESCE_MS`.
       */
      const commit = (mutate: (draft: WorkflowSchema) => void, tag?: string) => {
        const { schema, past } = get();
        const draft = structuredClone(schema);
        mutate(draft);

        const now = Date.now();
        const coalesce = tag !== undefined && tag === lastTag && now - lastTagAt < COALESCE_MS;
        lastTag = tag ?? null;
        lastTagAt = now;

        set({
          schema: draft,
          // Coalescing keeps the snapshot already on the stack: it holds the
          // state from before the burst started, which is where undo belongs.
          past: coalesce ? past : pushHistory(past, schema),
          future: [],
        });
      };

      /** Any history jump ends the current coalescing window. */
      const resetCoalescing = () => {
        lastTag = null;
      };

      return {
        schema: createEmptyWorkflowSchema(),
        selectedNodeId: null,
        selectedEdgeId: null,
        past: [],
        future: [],

        setSchema: (schema) => {
          const { schema: previous, past } = get();
          resetCoalescing();
          set({
            schema,
            past: pushHistory(past, previous),
            future: [],
            selectedNodeId: null,
            selectedEdgeId: null,
          });
        },

        updateSettings: (patch) => {
          commit((draft) => {
            Object.assign(draft, patch);
          });
        },

        addNode: (kind, at) => {
          const state = get();
          const node = createWorkflowNode(kind, state.schema.nodes, {
            x: snap(at?.x ?? 48),
            y: snap(at?.y ?? 48),
          });
          commit((draft) => {
            draft.nodes.push(node);
          });
          set({ selectedNodeId: node.id, selectedEdgeId: null });
        },

        updateNode: (id, patch) => {
          commit((draft) => {
            const node = draft.nodes.find((entry) => entry.id === id);
            if (!node) return;
            Object.assign(node, patch);
          });
        },

        moveNode: (id, x, y) => {
          commit((draft) => {
            const node = draft.nodes.find((entry) => entry.id === id);
            if (!node) return;
            // Clamped at zero: a node dragged off the top-left would otherwise
            // sit outside the stage with no way to scroll back to it.
            node.x = Math.max(0, snap(x));
            node.y = Math.max(0, snap(y));
          }, `move:${id}`);
        },

        duplicateNode: (id) => {
          const state = get();
          const node = state.schema.nodes.find((entry) => entry.id === id);
          if (!node) return;
          const copy = duplicateWorkflowNode(node, state.schema.nodes);
          commit((draft) => {
            draft.nodes.push(copy);
          });
          set({ selectedNodeId: copy.id, selectedEdgeId: null });
        },

        removeNode: (id) => {
          commit((draft) => {
            draft.nodes = draft.nodes.filter((node) => node.id !== id);
            // Edges to or from a deleted node are meaningless, so they go with
            // it — which is why `dangling-edge` only ever comes from raw JSON.
            draft.edges = draft.edges.filter((edge) => edge.from !== id && edge.to !== id);
          });
          const state = get();
          if (state.selectedNodeId === id) set({ selectedNodeId: null });
        },

        setNodeForm: (id, form) => {
          commit((draft) => {
            const node = draft.nodes.find((entry) => entry.id === id);
            if (!node) return;
            // Assigned by reference on purpose: the embedded editor compares
            // identity to tell its own write-back from an outside change.
            node.form = form;
          }, `form:${id}`);
        },

        setNodePage: (id, page) => {
          commit((draft) => {
            const node = draft.nodes.find((entry) => entry.id === id);
            if (!node) return;
            // By reference on purpose, like `setNodeForm`: the embedded editor
            // compares identity to tell its own write-back from an outside change.
            node.page = page;
          }, `page:${id}`);
        },

        setNodePositions: (positions) => {
          commit((draft) => {
            for (const node of draft.nodes) {
              const next = positions[node.id];
              if (!next) continue;
              // Same clamp and snap `moveNode` applies, so an arranged graph
              // sits on the grid a dragged one lands on.
              node.x = Math.max(0, snap(next.x));
              node.y = Math.max(0, snap(next.y));
            }
          });
        },

        addEdge: (from, to) => {
          const state = get();
          // A second identical branch is invisible under the first and can
          // never be taken, so it is refused rather than silently added.
          const duplicate = state.schema.edges.some(
            (edge) => edge.from === from && edge.to === to,
          );
          if (duplicate) return;

          const edge = createWorkflowEdge(state.schema, from, to);
          commit((draft) => {
            draft.edges.push(edge);
          });
          set({ selectedEdgeId: edge.id, selectedNodeId: null });
        },

        updateEdge: (id, patch) => {
          commit((draft) => {
            const edge = draft.edges.find((entry) => entry.id === id);
            if (!edge) return;
            Object.assign(edge, patch);
          });
        },

        removeEdge: (id) => {
          commit((draft) => {
            draft.edges = draft.edges.filter((edge) => edge.id !== id);
          });
          if (get().selectedEdgeId === id) set({ selectedEdgeId: null });
        },

        selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
        selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

        undo: () => {
          const { past, future, schema } = get();
          const previous = popHistory(past);
          if (!previous) return;
          resetCoalescing();
          set({
            schema: previous.head,
            past: previous.rest,
            future: [schema, ...future],
            selectedNodeId: null,
            selectedEdgeId: null,
          });
        },

        redo: () => {
          const { past, future, schema } = get();
          if (future.length === 0) return;
          const [next, ...rest] = future;
          resetCoalescing();
          set({
            schema: next,
            past: pushHistory(past, schema),
            future: rest,
            selectedNodeId: null,
            selectedEdgeId: null,
          });
        },

        clear: () => {
          const { schema: previous, past } = get();
          resetCoalescing();
          // Back to a runnable start/end pair rather than an empty canvas, for
          // the reason `createEmptyWorkflowSchema` gives.
          set({
            schema: createEmptyWorkflowSchema(),
            past: pushHistory(past, previous),
            future: [],
            selectedNodeId: null,
            selectedEdgeId: null,
          });
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // History and selection are session state, not saved work.
      partialize: (state) => ({ schema: state.schema }) as Partial<WorkflowState>,
      // Stored JSON is user-editable and may predate a schema change, so it
      // goes through the same validator as an imported file.
      merge: (persisted, current) => {
        const candidate = (persisted as { schema?: unknown } | undefined)?.schema;
        const result = parseWorkflowSchema(candidate);
        if (!result.ok) {
          if (candidate !== undefined) {
            console.warn('[form-generator] discarding invalid saved workflow', result.errors);
          }
          return current;
        }
        return { ...current, schema: result.schema };
      },
    },
  ),
);

export const selectWorkflowCanUndo = (state: WorkflowState) => state.past.length > 0;
export const selectWorkflowCanRedo = (state: WorkflowState) => state.future.length > 0;
