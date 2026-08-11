import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

/**
 * Where the payload comes from while a screen renders.
 *
 * A form asks and a page tells, so the two have always read values from
 * different places: a form's fields watch live `rc-field-form` state, while a
 * page is handed a finished payload and evaluates against it. Once one screen
 * can hold both kinds of node, something has to say which of the two is in
 * play — that is all this context is.
 *
 * `live` is fixed for the lifetime of a screen's tree: the root decides once,
 * based on whether it emitted a `<Form>`. That matters, because the live path
 * calls `Form.useWatch` and the static path must not — outside a form it warns
 * and returns nothing. Consumers therefore branch by rendering *different
 * components*, never by calling a hook conditionally.
 */
export interface ScreenContextValue {
  /** True when a `<Form>` surrounds these nodes and values are live. */
  live: boolean;
  /** The finished payload. Meaningful only when `live` is false. */
  values: Record<string, unknown>;
}

const EMPTY: Record<string, unknown> = {};

const ScreenContext = createContext<ScreenContextValue>({ live: false, values: EMPTY });

export interface ScreenContextProviderProps {
  live: boolean;
  values?: Record<string, unknown>;
  children: ReactNode;
}

export function ScreenContextProvider({
  live,
  values = EMPTY,
  children,
}: ScreenContextProviderProps) {
  const value = useMemo(() => ({ live, values }), [live, values]);
  return <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>;
}

export function useScreenContext(): ScreenContextValue {
  return useContext(ScreenContext);
}
