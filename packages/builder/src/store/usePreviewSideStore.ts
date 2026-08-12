import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Whether each preview shows the column beside the document it renders.
 *
 * Persisted rather than held in the pane, for the reason `useSummaryStore`
 * gives: `App.tsx` sets `destroyOnHidden` on the tabs, so a pane is unmounted
 * the moment you leave it. A `useState` would forget the choice on the way to
 * the Builder and back, and a toggle that resets itself is worse than none.
 *
 * One entry per panel, not one for the app. The three previews are opened for
 * different reasons, and a table's selection has nothing to say about a
 * workflow's trace.
 */
export type PreviewSidePanel = 'screen' | 'screenPayload' | 'table' | 'workflow';

/**
 * Where each panel sits before anyone has touched its toggle.
 *
 * Outputs start closed so the preview gets the full width, which is the whole
 * point. The payload editor starts open because it is an *input* — a screen
 * that only tells reads its `{{tokens}}` from it, so a closed one previews a
 * document with nothing driving it.
 *
 * That asymmetry is why `screen` and `screenPayload` are two entries for one
 * mode. The screen preview swaps its side column between the two, and a shared
 * entry would let "done looking at payloads" quietly take the input away —
 * leaving a screen rendering literal `{{token}}` text with nothing on screen
 * explaining why.
 */
const DEFAULT_SHOWN: Record<PreviewSidePanel, boolean> = {
  screen: false,
  screenPayload: true,
  table: false,
  workflow: false,
};

export interface PreviewSideState {
  shown: Record<PreviewSidePanel, boolean>;
  toggle: (panel: PreviewSidePanel) => void;
}

export const usePreviewSideStore = create<PreviewSideState>()(
  persist(
    (set) => ({
      shown: DEFAULT_SHOWN,
      toggle: (panel) =>
        set((state) => ({ shown: { ...state.shown, [panel]: !state.shown[panel] } })),
    }),
    {
      name: 'antd-form-generator:preview-side',
      storage: createJSONStorage(() => localStorage),
      // `shown` is nested and the default merge is shallow, so a blob written
      // before a panel existed would replace the whole map and leave that panel
      // `undefined` — which reads as false, rendering a default-*open* panel
      // closed. Fill the gaps from the defaults and ignore anything that is not
      // a boolean, the way `useAppMode` guards a stored mode it no longer knows.
      merge: (persisted, current) => {
        const saved = (persisted as { shown?: Record<string, unknown> } | undefined)?.shown;
        const shown = { ...DEFAULT_SHOWN };
        for (const panel of Object.keys(DEFAULT_SHOWN) as PreviewSidePanel[]) {
          const value = saved?.[panel];
          if (typeof value === 'boolean') shown[panel] = value;
        }
        return { ...current, shown };
      },
    },
  ),
);
