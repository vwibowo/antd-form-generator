import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createId } from '@/lib/ids';
import type { TableColumn, TableSchema, TableSource } from '@/schema/table';
import {
  createEmptyTableSchema,
  inferColumns,
  parseTableSchema,
  tableColumnSchema,
} from '@/schema/table';
import { popHistory, pushHistory } from './history';

const STORAGE_KEY = 'antd-form-generator:table';

export interface TableState {
  schema: TableSchema;
  selectedColumnId: string | null;
  past: TableSchema[];
  future: TableSchema[];

  setSchema: (schema: TableSchema) => void;
  updateSettings: (patch: Partial<TableSchema>) => void;
  updateSource: (patch: Partial<TableSource>) => void;
  setParams: (params: Record<string, string>) => void;

  addColumn: () => void;
  updateColumn: (id: string, patch: Partial<TableColumn>) => void;
  removeColumn: (id: string) => void;
  /** Reorder to an absolute index in the column list — the drag drop. */
  moveColumn: (id: string, toIndex: number) => void;
  /** Replace the column list from sample rows — the "Detect columns" button. */
  detectColumns: (rows: unknown[]) => void;

  selectColumn: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useTableStore = create<TableState>()(
  persist(
    (set, get) => {
      /** Apply a mutation to a cloned document and push the previous one. */
      const commit = (mutate: (draft: TableSchema) => void) => {
        const { schema, past } = get();
        const draft = structuredClone(schema);
        mutate(draft);
        set({ schema: draft, past: pushHistory(past, schema), future: [] });
      };

      return {
        schema: createEmptyTableSchema(),
        selectedColumnId: null,
        past: [],
        future: [],

        setSchema: (schema) => {
          const { schema: previous, past } = get();
          set({
            schema,
            past: pushHistory(past, previous),
            future: [],
            selectedColumnId: null,
          });
        },

        updateSettings: (patch) => {
          commit((draft) => {
            Object.assign(draft, patch);
          });
        },

        updateSource: (patch) => {
          commit((draft) => {
            draft.source = { ...draft.source, ...patch };
          });
        },

        setParams: (params) => {
          commit((draft) => {
            draft.params = params;
          });
        },

        addColumn: () => {
          const column = tableColumnSchema.parse({
            id: createId('col'),
            key: '',
            title: `Column ${get().schema.columns.length + 1}`,
          });
          commit((draft) => {
            draft.columns.push(column);
          });
          set({ selectedColumnId: column.id });
        },

        updateColumn: (id, patch) => {
          commit((draft) => {
            const column = draft.columns.find((entry) => entry.id === id);
            if (column) Object.assign(column, patch);
          });
        },

        removeColumn: (id) => {
          commit((draft) => {
            draft.columns = draft.columns.filter((column) => column.id !== id);
          });
          if (get().selectedColumnId === id) set({ selectedColumnId: null });
        },

        moveColumn: (id, toIndex) => {
          commit((draft) => {
            const from = draft.columns.findIndex((column) => column.id === id);
            if (from === -1) return;
            const [moved] = draft.columns.splice(from, 1);
            // Remove-then-insert, matching dnd-kit's `arrayMove`, so the drop
            // lands exactly where the sortable preview showed it.
            const at = Math.max(0, Math.min(toIndex, draft.columns.length));
            draft.columns.splice(at, 0, moved);
          });
        },

        detectColumns: (rows) => {
          const columns = inferColumns(rows);
          if (columns.length === 0) return;
          commit((draft) => {
            draft.columns = columns;
          });
          set({ selectedColumnId: null });
        },

        selectColumn: (id) => set({ selectedColumnId: id }),

        undo: () => {
          const { past, future, schema } = get();
          const previous = popHistory(past);
          if (!previous) return;
          set({
            schema: previous.head,
            past: previous.rest,
            future: [schema, ...future],
            selectedColumnId: null,
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
            selectedColumnId: null,
          });
        },

        clear: () => {
          commit((draft) => {
            draft.columns = [];
            draft.source.rows = [];
          });
          set({ selectedColumnId: null });
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // History and selection are session state, not saved work.
      partialize: (state) => ({ schema: state.schema }) as Partial<TableState>,
      // Stored JSON is user-editable and may predate a schema change, so it
      // goes through the same validator as an imported file.
      merge: (persisted, current) => {
        const candidate = (persisted as { schema?: unknown } | undefined)?.schema;
        const result = parseTableSchema(candidate);
        if (!result.ok) {
          if (candidate !== undefined) {
            console.warn('[form-generator] discarding invalid saved table', result.errors);
          }
          return current;
        }
        return { ...current, schema: result.schema };
      },
    },
  ),
);

export const selectTableCanUndo = (state: TableState) => state.past.length > 0;
export const selectTableCanRedo = (state: TableState) => state.future.length > 0;
