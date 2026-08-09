import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The values the Summary tab renders, held as the raw text of its editor.
 *
 * Text rather than a parsed object on purpose: the tabs are `destroyOnHidden`,
 * so a half-typed edit would otherwise be lost on every tab switch — and an
 * object could not hold one at all.
 *
 * These are sample values for previewing a summary page, not part of either
 * document, so they live in their own key and never touch the schema stores.
 */
export interface SummaryState {
  draft: string;
  setDraft: (draft: string) => void;
  reset: () => void;
}

export const useSummaryStore = create<SummaryState>()(
  persist(
    (set) => ({
      draft: '',
      setDraft: (draft) => set({ draft }),
      reset: () => set({ draft: '' }),
    }),
    { name: 'antd-form-generator:summary-values', storage: createJSONStorage(() => localStorage) },
  ),
);
