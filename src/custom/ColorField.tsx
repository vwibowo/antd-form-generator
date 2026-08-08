import { ColorPicker } from 'antd';
import type { CustomFieldProps } from '@/renderer/custom';

/**
 * Demo custom component: an antd `ColorPicker` whose value is a hex string.
 *
 * Shows the minimum contract — read `value`, call `onChange`, honour `disabled`.
 * Everything else it needs comes out of `node.props`, whose editor rows are
 * declared beside the component in `index.ts`.
 */
export function ColorField({ value, onChange, disabled, node }: CustomFieldProps<string>) {
  const showText = node.props?.showText === true;
  const size = node.props?.size === 'large' ? 'large' : undefined;

  return (
    <ColorPicker
      disabled={disabled}
      size={size}
      showText={showText}
      value={value ?? null}
      onChange={(color) => onChange?.(color.toHexString())}
    />
  );
}
