import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createField, duplicateField } from '@/schema/factory';
import type { FieldNode, FieldType, FormSchema } from '@/schema/schema';
import { createEmptySchema, isContainerType, parseFormSchema } from '@/schema/schema';
import {
  ROOT_CONTAINER_ID,
  findField,
  findParent,
  getContainerChildren,
  isDescendantOf,
  locate,
} from '@/schema/walk';

const STORAGE_KEY = 'antd-form-generator:schema';
const HISTORY_LIMIT = 50;

export interface SchemaState {
  schema: FormSchema;
  selectedId: string | null;
  past: FormSchema[];
  future: FormSchema[];

  addField: (type: FieldType, containerId?: string, index?: number) => void;
  moveField: (id: string, toContainerId: string, toIndex: number) => void;
  updateField: (id: string, patch: Partial<FieldNode>) => void;
  duplicateNode: (id: string) => void;
  removeField: (id: string) => void;
  updateSettings: (patch: Partial<FormSchema>) => void;
  setSchema: (schema: FormSchema) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

/**
 * Cards are page sections, so they take other containers — a repeatable
 * belongs inside one. Everything else stays flat: `group` and `list` hold
 * plain fields only.
 *
 * Requiring the receiving card to be top-level caps container nesting at two
 * levels (`root > card > list`) without tracking a depth counter, which keeps
 * both the drop logic and the generated JSON legible.
 */
export function canDropInto(
  schema: FormSchema,
  type: FieldType,
  containerId: string,
): boolean {
  if (containerId === ROOT_CONTAINER_ID) return true;
  const container = findField(schema.fields, containerId);
  if (!container || !isContainerType(container.type)) return false;

  if (isContainerType(type)) {
    if (container.type !== 'card') return false;
    return findParent(schema.fields, container.id) === null;
  }
  return true;
}

export const useSchemaStore = create<SchemaState>()(
  persist(
    (set, get) => {
      /** Apply a mutation to a cloned schema and push the previous one onto history. */
      const commit = (mutate: (draft: FormSchema) => void) => {
        const { schema, past } = get();
        const draft = structuredClone(schema);
        mutate(draft);
        set({
          schema: draft,
          past: [...past, schema].slice(-HISTORY_LIMIT),
          future: [],
        });
      };

      return {
        schema: createEmptySchema(),
        selectedId: null,
        past: [],
        future: [],

        addField: (type, containerId = ROOT_CONTAINER_ID, index) => {
          const state = get();
          if (!canDropInto(state.schema, type, containerId)) return;

          const node = createField(type, state.schema.fields);
          commit((draft) => {
            const children = getContainerChildren(draft, containerId);
            if (!children) return;
            const at = index === undefined ? children.length : index;
            children.splice(Math.max(0, Math.min(at, children.length)), 0, node);
          });
          set({ selectedId: node.id });
        },

        moveField: (id, toContainerId, toIndex) => {
          const state = get();
          const node = findField(state.schema.fields, id);
          if (!node) return;
          if (!canDropInto(state.schema, node.type, toContainerId)) return;
          // Never drop a container inside its own subtree.
          if (
            toContainerId !== ROOT_CONTAINER_ID &&
            isDescendantOf(state.schema.fields, id, toContainerId)
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

        updateField: (id, patch) => {
          commit((draft) => {
            const node = findField(draft.fields, id);
            if (!node) return;
            Object.assign(node, patch);
          });
        },

        duplicateNode: (id) => {
          const state = get();
          const node = findField(state.schema.fields, id);
          if (!node) return;
          const copy = duplicateField(node, state.schema.fields);
          commit((draft) => {
            const found = locate(draft, id);
            if (!found) return;
            found.siblings.splice(found.index + 1, 0, copy);
          });
          set({ selectedId: copy.id });
        },

        removeField: (id) => {
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
            past: [...past, previous].slice(-HISTORY_LIMIT),
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
            past: [...past, schema].slice(-HISTORY_LIMIT),
            future: rest,
            selectedId: null,
          });
        },

        clear: () => {
          commit((draft) => {
            draft.fields = [];
          });
          set({ selectedId: null });
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // History and selection are session state, not saved work.
      partialize: (state) => ({ schema: state.schema }) as Partial<SchemaState>,
      // Stored JSON is user-editable and may predate a schema change, so it
      // goes through the same validator as an imported file.
      merge: (persisted, current) => {
        const candidate = (persisted as { schema?: unknown } | undefined)?.schema;
        const result = parseFormSchema(candidate);
        if (!result.ok) {
          if (candidate !== undefined) {
            console.warn('[form-generator] discarding invalid saved schema', result.errors);
          }
          return current;
        }
        return { ...current, schema: result.schema };
      },
    },
  ),
);

export const selectCanUndo = (state: SchemaState) => state.past.length > 0;
export const selectCanRedo = (state: SchemaState) => state.future.length > 0;
