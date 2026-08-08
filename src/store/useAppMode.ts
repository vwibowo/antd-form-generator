import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DocumentKind } from '@/schema/document';

/**
 * Which document the three tabs are editing. Persisted so a reload comes back
 * to what you were working on, in its own key — the two documents are stored
 * separately and neither owns the mode.
 */
export interface AppModeState {
  mode: DocumentKind;
  setMode: (mode: DocumentKind) => void;
}

export const useAppMode = create<AppModeState>()(
  persist(
    (set) => ({
      mode: 'form',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'antd-form-generator:mode', storage: createJSONStorage(() => localStorage) },
  ),
);
