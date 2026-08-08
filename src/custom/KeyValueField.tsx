import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Space } from 'antd';
import type { CustomFieldProps } from '@/renderer/custom';

export interface KeyValueRow {
  key: string;
  value: string;
}

/**
 * Demo custom component with a value antd has no control for: a list of
 * key/value pairs. It holds an array while the form is open and its registry
 * entry serialises that into a plain object at submit time — the case a
 * built-in field type cannot express.
 */
export function KeyValueField({
  value,
  onChange,
  disabled,
  node,
}: CustomFieldProps<KeyValueRow[]>) {
  const rows = Array.isArray(value) ? value : [];
  const maxRows = typeof node.props?.maxRows === 'number' ? node.props.maxRows : undefined;
  const keyPlaceholder =
    typeof node.props?.keyPlaceholder === 'string' ? node.props.keyPlaceholder : 'Key';
  const valuePlaceholder =
    typeof node.props?.valuePlaceholder === 'string' ? node.props.valuePlaceholder : 'Value';

  const patch = (index: number, part: Partial<KeyValueRow>) => {
    onChange?.(rows.map((row, at) => (at === index ? { ...row, ...part } : row)));
  };

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {rows.map((row, index) => (
        // Rows are positional and have no stable id of their own; reordering is
        // not offered, so the index is the identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: positional by design
        <Space.Compact key={index} style={{ width: '100%' }}>
          <Input
            disabled={disabled}
            placeholder={keyPlaceholder}
            value={row.key}
            onChange={(event) => patch(index, { key: event.target.value })}
          />
          <Input
            disabled={disabled}
            placeholder={valuePlaceholder}
            value={row.value}
            onChange={(event) => patch(index, { value: event.target.value })}
          />
          <Button
            danger
            disabled={disabled}
            icon={<DeleteOutlined />}
            aria-label="Remove pair"
            onClick={() => onChange?.(rows.filter((_, at) => at !== index))}
          />
        </Space.Compact>
      ))}

      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        disabled={disabled || (maxRows !== undefined && rows.length >= maxRows)}
        onClick={() => onChange?.([...rows, { key: '', value: '' }])}
      >
        Add pair
      </Button>
    </Space>
  );
}
