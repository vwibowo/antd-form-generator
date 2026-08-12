import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DocumentKind } from '@antd-form-generator/core/schema/document';

/**
 * Which document the tabs are editing. Persisted so a reload comes back to what
 * you were working on, in its own key — the documents are stored separately and
 * none of them owns the mode.
 */
export interface AppModeState {
  mode: DocumentKind;
  setMode: (mode: DocumentKind) => void;
}

export const useAppMode = create<AppModeState>()(
  persist(
    (set) => ({
      mode: 'screen',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'antd-form-generator:mode',
      storage: createJSONStorage(() => localStorage),
      // `form` and `page` were separate modes before the merge; a stored one of
      // either now means the screen builder.
      merge: (persisted, current) => {
        const saved = (persisted as { mode?: unknown } | undefined)?.mode;
        const mode =
          saved === 'table' || saved === 'workflow' ? saved : ('screen' as DocumentKind);
        return { ...current, mode };
      },
    },
  ),
);
