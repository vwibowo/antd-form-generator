import { create, createStore } from 'zustand';
import type { StateCreator, StoreApi } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CreateNodeSeed } from '@antd-form-generator/core/schema/factory';
import { cloneNode, createNode } from '@antd-form-generator/core/schema/factory';
import { migrateToScreen } from '@antd-form-generator/core/schema/migrate';
import type { ScreenNode, ScreenNodeType, ScreenSchema } from '@antd-form-generator/core/schema/screen';
import { createEmptyScreenSchema, parseScreenSchema } from '@antd-form-generator/core/schema/screen';
import {
  ROOT_CONTAINER_ID,
  canDropInto,
  findNode,
  getContainerChildren,
  isDescendantOf,
  locate,
} from '@antd-form-generator/core/schema/walk';
import { HISTORY_LIMIT, pushHistory } from './history';

// Re-exported because the drop rules used to live here and callers reach for
// them at this path. They are a schema rule, not a store one — see `walk.ts`.
export { canDropInto } from '@antd-form-generator/core/schema/walk';

const STORAGE_KEY = 'antd-form-generator:screen';
/** What older builds wrote, read once so saved work survives the merge. */
const LEGACY_KEYS = ['antd-form-generator:schema', 'antd-form-generator:page'];

export interface ScreenState {
  schema: ScreenSchema;
  selectedId: string | null;
  past: ScreenSchema[];
  future: ScreenSchema[];

  addNode: (
    type: ScreenNodeType,
    containerId?: string,
    index?: number,
    seed?: CreateNodeSeed,
  ) => void;
  moveNode: (id: string, toContainerId: string, toIndex: number) => void;
  updateNode: (id: string, patch: Partial<ScreenNode>) => void;
  duplicateNode: (id: string) => void;
  removeNode: (id: string) => void;
  updateSettings: (patch: Partial<ScreenSchema>) => void;
  setSchema: (schema: ScreenSchema) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

/**
 * What a screen document does, separated from where it lives.
 *
 * The app-level singleton below wraps this in `persist`; a workflow's `screen`
 * node gets an unpersisted instance of its own. Both behave identically, which
 * is what lets the same palette, canvas and inspector edit either one.
 *
 * A page document needed none of the tree walking — its blocks were flat. That
 * is this store with nothing nestable in it, which is why there is no second
 * one: `addNode(type, ROOT_CONTAINER_ID, index)` is what `addBlock` was.
 */
const screenStateCreator: StateCreator<ScreenState> = (set, get) => {
  /** Apply a mutation to a cloned schema and push the previous one onto history. */
  const commit = (mutate: (draft: ScreenSchema) => void) => {
    const { schema, past } = get();
    const draft = structuredClone(schema);
    mutate(draft);
    set({
      schema: draft,
      past: pushHistory(past, schema),
      future: [],
    });
  };

  return {
    schema: createEmptyScreenSchema(),
    selectedId: null,
    past: [],
    future: [],

    addNode: (type, containerId = ROOT_CONTAINER_ID, index, seed) => {
      const state = get();
      if (!canDropInto(state.schema, type, containerId)) return;

      const node = createNode(type, state.schema.nodes, seed);
      commit((draft) => {
        const children = getContainerChildren(draft, containerId);
        if (!children) return;
        const at = index === undefined ? children.length : index;
        children.splice(Math.max(0, Math.min(at, children.length)), 0, node);
      });
      set({ selectedId: node.id });
    },

    moveNode: (id, toContainerId, toIndex) => {
      const state = get();
      const node = findNode(state.schema.nodes, id);
      if (!node) return;
      if (!canDropInto(state.schema, node.type, toContainerId)) return;
      // Never drop a container inside its own subtree.
      if (
        toContainerId !== ROOT_CONTAINER_ID &&
        isDescendantOf(state.schema.nodes, id, toContainerId)
      ) {
        return;
      }

      commit((draft) => {
        const found = locate(draft, id);
        if (!found) return;
        const [moved] = found.siblings.splice(found.index, 1);

        const target = getContainerChildren(draft, toContainerId);
        if (!target) {
          // Target vanished — put it back where it came from.
          found.siblings.splice(found.index, 0, moved);
          return;
        }
        // Remove-then-insert-at-index, matching dnd-kit's `arrayMove`, so
        // the drop lands exactly where the sortable preview showed it.
        target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, moved);
      });
    },

    updateNode: (id, patch) => {
      commit((draft) => {
        const node = findNode(draft.nodes, id);
        if (!node) return;
        Object.assign(node, patch);
      });
    },

    duplicateNode: (id) => {
      const state = get();
      const node = findNode(state.schema.nodes, id);
      if (!node) return;
      const copy = cloneNode(node, state.schema.nodes);
      commit((draft) => {
        const found = locate(draft, id);
        if (!found) return;
        found.siblings.splice(found.index + 1, 0, copy);
      });
      set({ selectedId: copy.id });
    },

    removeNode: (id) => {
      commit((draft) => {
        const found = locate(draft, id);
        if (!found) return;
        found.siblings.splice(found.index, 1);
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
      set({
        schema,
        past: pushHistory(past, previous),
        future: [],
        selectedId: null,
      });
    },

    select: (id) => set({ selectedId: id }),

    undo: () => {
      const { past, future, schema } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        schema: previous,
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
        draft.nodes = [];
      });
      set({ selectedId: null });
    },
  };
};

/**
 * A standalone screen document, not persisted and not the app's.
 *
 * A workflow's `screen` node holds a whole `ScreenSchema`, and the builder panes
 * were written against the singleton below; handing them one of these through
 * `ScreenStoreProvider` is what lets them edit a screen they do not own.
 */
export function createScreenStore(schema: ScreenSchema): StoreApi<ScreenState> {
  const store = createStore<ScreenState>(screenStateCreator);
  // Seeded after creation rather than through the creator so history starts
  // empty: the document this store opens with is not an edit anyone can undo.
  store.setState({ schema });
  return store;
}

/**
 * A document saved by a build that still had separate form and page documents.
 *
 * `persist` only ever reads its own key, so the two old ones have to be looked
 * up by hand. Whichever is found goes through `migrateToScreen` like any other
 * legacy JSON; the first one wins, because a `screen` key already existing
 * means this has run before and neither is worth reading again.
 */
function readLegacySchema(): unknown {
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      const parsed = JSON.parse(raw) as { state?: { schema?: unknown } };
      const candidate = parsed?.state?.schema;
      if (candidate !== undefined) return migrateToScreen(candidate);
    } catch {
      // Unreadable JSON under a key nothing writes any more — ignore it.
    }
  }
  return undefined;
}

export const useScreenStore = create<ScreenState>()(
  persist(screenStateCreator, {
    name: STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    // History and selection are session state, not saved work.
    partialize: (state) => ({ schema: state.schema }) as Partial<ScreenState>,
    // Stored JSON is user-editable and may predate a schema change, so it
    // goes through the same validator as an imported file.
    merge: (persisted, current) => {
      const saved = (persisted as { schema?: unknown } | undefined)?.schema;
      // Nothing under the new key yet: this is the first load after the merge,
      // so fall back to whatever the form or page store left behind.
      const candidate = saved ?? readLegacySchema();
      const result = parseScreenSchema(migrateToScreen(candidate));
      if (!result.ok) {
        if (candidate !== undefined) {
          console.warn('[form-generator] discarding invalid saved screen', result.errors);
        }
        return current;
      }
      return { ...current, schema: result.schema };
    },
  }),
);

export const selectScreenCanUndo = (state: ScreenState) => state.past.length > 0;
export const selectScreenCanRedo = (state: ScreenState) => state.future.length > 0;
