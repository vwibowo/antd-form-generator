import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Space, Typography } from 'antd';
import type { SelectOption } from '@/schema/screen';

export interface OptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const update = (index: number, patch: Partial<SelectOption>) => {
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  return (
    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
        <Typography.Text type="secondary" style={{ flex: 1, fontSize: 11 }}>
          Label
        </Typography.Text>
        <Typography.Text type="secondary" style={{ flex: 1, fontSize: 11 }}>
          Value
        </Typography.Text>
        <span style={{ width: 24 }} />
      </div>

      {options.map((option, index) => (
        <div key={index} style={{ display: 'flex', gap: 6 }}>
          <Input
            size="small"
            value={option.label}
            placeholder="Label"
            onChange={(event) => update(index, { label: event.target.value })}
          />
          <Input
            size="small"
            value={String(option.value)}
            placeholder="Value"
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label="Remove option"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          />
        </div>
      ))}

      <Button
        size="small"
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() =>
          onChange([
            ...options,
            { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` },
          ])
        }
      >
        Add option
      </Button>
    </Space>
  );
}
