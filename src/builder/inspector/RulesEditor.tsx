import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select, Space } from 'antd';
import type { RuleKind, RuleSpec } from '@/schema/screen';

export interface RulesEditorProps {
  rules: RuleSpec[];
  onChange: (rules: RuleSpec[]) => void;
}

const KIND_OPTIONS: { label: string; value: RuleKind }[] = [
  { label: 'Required', value: 'required' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'Exact length', value: 'len' },
  { label: 'Pattern', value: 'pattern' },
  { label: 'Format', value: 'type' },
];

const TYPE_OPTIONS = [
  { label: 'Email', value: 'email' },
  { label: 'URL', value: 'url' },
  { label: 'Number', value: 'number' },
  { label: 'Integer', value: 'integer' },
];

function defaultForKind(kind: RuleKind): RuleSpec {
  switch (kind) {
    case 'required':
      return { kind: 'required' };
    case 'pattern':
      return { kind: 'pattern', value: '' };
    case 'type':
      return { kind: 'type', value: 'email' };
    default:
      return { kind, value: 0 };
  }
}

export function RulesEditor({ rules, onChange }: RulesEditorProps) {
  const replace = (index: number, rule: RuleSpec) => {
    onChange(rules.map((existing, i) => (i === index ? rule : existing)));
  };

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {rules.map((rule, index) => (
        <div
          key={index}
          style={{
            border: '1px solid rgba(5, 5, 5, 0.08)',
            borderRadius: 8,
            padding: 8,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <Select
              size="small"
              style={{ flex: 1 }}
              value={rule.kind}
              options={KIND_OPTIONS}
              onChange={(kind) => replace(index, defaultForKind(kind))}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="Remove rule"
              onClick={() => onChange(rules.filter((_, i) => i !== index))}
            />
          </div>

          {rule.kind === 'min' || rule.kind === 'max' || rule.kind === 'len' ? (
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={rule.value}
              placeholder="Value"
              onChange={(value) => replace(index, { ...rule, value: value ?? 0 })}
            />
          ) : null}

          {rule.kind === 'pattern' ? (
            <Input
              size="small"
              value={rule.value}
              placeholder="Regular expression, e.g. ^[A-Z]{2}\d+$"
              onChange={(event) => replace(index, { ...rule, value: event.target.value })}
            />
          ) : null}

          {rule.kind === 'type' ? (
            <Select
              size="small"
              style={{ width: '100%' }}
              value={rule.value}
              options={TYPE_OPTIONS}
              onChange={(value) => replace(index, { ...rule, value })}
            />
          ) : null}

          <Input
            size="small"
            value={rule.message ?? ''}
            placeholder="Custom message (optional)"
            onChange={(event) =>
              replace(index, { ...rule, message: event.target.value || undefined })
            }
          />
        </div>
      ))}

      <Button
        size="small"
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => onChange([...rules, { kind: 'required' }])}
      >
        Add rule
      </Button>
    </Space>
  );
}
