import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { SchemaState } from './useSchemaStore';
import { useSchemaStore } from './useSchemaStore';

/**
 * Which form document the builder panes edit.
 *
 * The palette, canvas and inspector were written against the app-level
 * singleton. A workflow's `form` node needs that identical UI bound to a
 * different document, so the binding moved behind this context: no provider
 * means the singleton, which is what plain Form mode still gets.
 */
const SchemaStoreContext = createContext<StoreApi<SchemaState> | null>(null);

export function SchemaStoreProvider({
  store,
  children,
}: {
  store: StoreApi<SchemaState>;
  children: ReactNode;
}) {
  return <SchemaStoreContext.Provider value={store}>{children}</SchemaStoreContext.Provider>;
}

/**
 * Drop-in for `useSchemaStore(selector)` inside the builder panes.
 *
 * A selector is required rather than optional because every call site already
 * passes one, which keeps this to a single `useStore` call and no branching.
 */
export function useFormBuilderStore<T>(selector: (state: SchemaState) => T): T {
  // `useSchemaStore` is a bound hook and a `StoreApi` at the same time, so it
  // stands in for a missing context value without a second code path.
  const store = useContext(SchemaStoreContext) ?? useSchemaStore;
  return useStore(store, selector);
}
