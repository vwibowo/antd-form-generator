import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { PageState } from './usePageStore';
import { usePageStore } from './usePageStore';

/**
 * Which page document the page builder edits.
 *
 * The same seam `SchemaStoreContext` is for forms: no provider means the
 * app-level singleton, and a workflow's `page` node supplies one of its own so
 * the identical builder can edit a page it does not own.
 */
const PageStoreContext = createContext<StoreApi<PageState> | null>(null);

export function PageStoreProvider({
  store,
  children,
}: {
  store: StoreApi<PageState>;
  children: ReactNode;
}) {
  return <PageStoreContext.Provider value={store}>{children}</PageStoreContext.Provider>;
}

/** Drop-in for `usePageStore(selector)` inside the page builder panes. */
export function usePageBuilderStore<T>(selector: (state: PageState) => T): T {
  // `usePageStore` is a bound hook and a `StoreApi` at once, so it stands in for
  // a missing context value without a second code path.
  const store = useContext(PageStoreContext) ?? usePageStore;
  return useStore(store, selector);
}
