import { create, createStore } from 'zustand';
import type { StateCreator, StoreApi } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PageBlock, PageBlockType, PageSchema } from '@/schema/page';
import { createEmptyPageSchema, parsePageSchema } from '@/schema/page';
import { createPageBlock, duplicatePageBlock } from '@/schema/pageFactory';
import { HISTORY_LIMIT, pushHistory } from './history';

const STORAGE_KEY = 'antd-form-generator:page';

export interface PageState {
  schema: PageSchema;
  selectedId: string | null;
  past: PageSchema[];
  future: PageSchema[];

  addBlock: (type: PageBlockType, index?: number) => void;
  updateBlock: (id: string, patch: Partial<PageBlock>) => void;
  /** Reorder to an absolute index — the drag drop. */
  moveBlock: (id: string, toIndex: number) => void;
  duplicateBlock: (id: string) => void;
  removeBlock: (id: string) => void;
  updateSettings: (patch: Partial<PageSchema>) => void;
  setSchema: (schema: PageSchema) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

/**
 * What a page document does, separated from where it lives.
 *
 * The app-level singleton below wraps this in `persist`; a workflow's `page`
 * node gets an unpersisted instance of its own. Exactly the split
 * `useSchemaStore` makes for forms, and for the same reason — it is what lets
 * one builder edit either document.
 */
const pageStateCreator: StateCreator<PageState> = (set, get) => {
  /** Apply a mutation to a cloned schema and push the previous one onto history. */
  const commit = (mutate: (draft: PageSchema) => void) => {
    const { schema, past } = get();
    const draft = structuredClone(schema);
    mutate(draft);
    set({ schema: draft, past: pushHistory(past, schema), future: [] });
  };

  return {
    schema: createEmptyPageSchema(),
    selectedId: null,
    past: [],
    future: [],

    addBlock: (type, index) => {
      const block = createPageBlock(type);
      commit((draft) => {
        const at = index === undefined ? draft.blocks.length : index;
        draft.blocks.splice(Math.max(0, Math.min(at, draft.blocks.length)), 0, block);
      });
      set({ selectedId: block.id });
    },

    updateBlock: (id, patch) => {
      commit((draft) => {
        const block = draft.blocks.find((entry) => entry.id === id);
        if (!block) return;
        Object.assign(block, patch);
      });
    },

    moveBlock: (id, toIndex) => {
      commit((draft) => {
        const from = draft.blocks.findIndex((entry) => entry.id === id);
        if (from === -1) return;
        const [moved] = draft.blocks.splice(from, 1);
        // Remove-then-insert-at-index, matching dnd-kit's `arrayMove`, so the
        // drop lands exactly where the sortable preview showed it.
        draft.blocks.splice(Math.max(0, Math.min(toIndex, draft.blocks.length)), 0, moved);
      });
    },

    duplicateBlock: (id) => {
      const state = get();
      const block = state.schema.blocks.find((entry) => entry.id === id);
      if (!block) return;
      const copy = duplicatePageBlock(block);
      commit((draft) => {
        const index = draft.blocks.findIndex((entry) => entry.id === id);
        draft.blocks.splice(index + 1, 0, copy);
      });
      set({ selectedId: copy.id });
    },

    removeBlock: (id) => {
      commit((draft) => {
        draft.blocks = draft.blocks.filter((entry) => entry.id !== id);
      });
      if (get().selectedId === id) set({ selectedId: null });
    },

    updateSettings: (patch) => {
      commit((draft) => {
        Object.assign(draft, patch);
      });
    },

    setSchema: (schema) => {
      const { schema: previous, past } = get();
      set({ schema, past: pushHistory(past, previous), future: [], selectedId: null });
    },

    select: (id) => set({ selectedId: id }),

    undo: () => {
      const { past, future, schema } = get();
      if (past.length === 0) return;
      set({
        schema: past[past.length - 1],
        past: past.slice(0, -1),
        future: [schema, ...future].slice(0, HISTORY_LIMIT),
        selectedId: null,
      });
    },

    redo: () => {
      const { past, future, schema } = get();
      if (future.length === 0) return;
      const [next, ...rest] = future;
      set({
        schema: next,
        past: pushHistory(past, schema),
        future: rest,
        selectedId: null,
      });
    },

    clear: () => {
      commit((draft) => {
        draft.blocks = [];
      });
      set({ selectedId: null });
    },
  };
};

/**
 * A standalone page document, not persisted and not the app's — what a
 * workflow's `page` node is edited through.
 */
export function createPageStore(schema: PageSchema): StoreApi<PageState> {
  const store = createStore<PageState>(pageStateCreator);
  // Seeded after creation so history starts empty: the document this store
  // opens with is not an edit anyone can undo.
  store.setState({ schema });
  return store;
}

export const usePageStore = create<PageState>()(
  persist(pageStateCreator, {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    // History and selection are session state, not saved work.
    partialize: (state) => ({ schema: state.schema }) as Partial<PageState>,
    // Stored JSON is user-editable and may predate a schema change, so it goes
    // through the same validator as an imported file.
    merge: (persisted, current) => {
      const candidate = (persisted as { schema?: unknown } | undefined)?.schema;
      const result = parsePageSchema(candidate);
      if (!result.ok) {
        if (candidate !== undefined) {
          console.warn('[form-generator] discarding invalid saved page', result.errors);
        }
        return current;
      }
      return { ...current, schema: result.schema };
    },
  }),
);

export const selectPageCanUndo = (state: PageState) => state.past.length > 0;
export const selectPageCanRedo = (state: PageState) => state.future.length > 0;
