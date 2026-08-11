import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { ScreenState } from './useScreenStore';
import { useScreenStore } from './useScreenStore';

/**
 * Which screen document the builder panes edit.
 *
 * The palette, canvas and inspector were written against the app-level
 * singleton. A workflow's `screen` node needs that identical UI bound to a
 * different document, so the binding moved behind this context: no provider
 * means the singleton, which is what plain Screen mode still gets.
 */
const ScreenStoreContext = createContext<StoreApi<ScreenState> | null>(null);

export function ScreenStoreProvider({
  store,
  children,
}: {
  store: StoreApi<ScreenState>;
  children: ReactNode;
}) {
  return <ScreenStoreContext.Provider value={store}>{children}</ScreenStoreContext.Provider>;
}

/**
 * Drop-in for `useScreenStore(selector)` inside the builder panes.
 *
 * A selector is required rather than optional because every call site already
 * passes one, which keeps this to a single `useStore` call and no branching.
 */
export function useBuilderStore<T>(selector: (state: ScreenState) => T): T {
  // `useScreenStore` is a bound hook and a `StoreApi` at the same time, so it
  // stands in for a missing context value without a second code path.
  const store = useContext(ScreenStoreContext) ?? useScreenStore;
  return useStore(store, selector);
}
