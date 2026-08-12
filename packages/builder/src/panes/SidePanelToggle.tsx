import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import type { PreviewSidePanel } from '../store/usePreviewSideStore';
import { usePreviewSideStore } from '../store/usePreviewSideStore';

export interface SidePanelToggleProps {
  /** Which stored flag this button drives. */
  panel: PreviewSidePanel;
  /**
   * What the column is called, as the button's own text — usually the title of
   * the card it reveals. The workflow says "Run details" because it reveals two
   * and neither title covers both.
   */
  label: string;
}

/**
 * Show or hide the column beside a preview.
 *
 * It belongs in the `extra` of the card that is *always* there, never inside the
 * column it controls: a control inside the thing it hides can only be used once.
 *
 * Labelled, unlike the otherwise identical control in `table/ColumnList.tsx`.
 * Everything this reveals starts hidden, so the button is the only evidence the
 * column exists at all, and a bare eye in a card header is not evidence enough.
 * The eye pair is that control's, so a crossed eye already means "hidden"
 * everywhere in this builder — and as there, the icon shows the current state
 * while the tooltip names the action.
 *
 * The visible text is the accessible name and `aria-pressed` carries the state,
 * which is why there is no `aria-label`: one would override the text, and a name
 * that changes with the state only repeats what `aria-pressed` already says.
 */
export function SidePanelToggle({ panel, label }: SidePanelToggleProps) {
  const shown = usePreviewSideStore((state) => state.shown[panel]);
  const toggle = usePreviewSideStore((state) => state.toggle);

  return (
    <Tooltip title={shown ? 'Hide' : 'Show'}>
      <Button
        type="text"
        size="small"
        aria-pressed={shown}
        data-testid={`side-toggle-${panel}`}
        icon={shown ? <EyeOutlined /> : <EyeInvisibleOutlined />}
        onClick={() => toggle(panel)}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
