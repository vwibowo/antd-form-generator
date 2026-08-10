import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Segmented, Select, Space, Switch, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { Condition, ConditionGroup, ConditionOperator } from '@/schema/schema';
import { UNARY_OPERATORS } from '@/schema/schema';

export interface ConditionEditorProps {
  condition: ConditionGroup | undefined;
  /** Every other field's name, for the "when" picker. */
  fieldChoices: { label: string; value: string }[];
  onChange: (condition: ConditionGroup | undefined) => void;
  /** What the switch turns on. Defaults to the field-visibility wording. */
  label?: string;
  /** Small print under the list. Omit for none — there is no default. */
  hint?: ReactNode;
}

const OPERATOR_OPTIONS: { label: string; value: ConditionOperator }[] = [
  { label: 'equals', value: 'eq' },
  { label: 'does not equal', value: 'neq' },
  { label: 'is one of', value: 'in' },
  { label: 'is not one of', value: 'notIn' },
  { label: 'is greater than', value: 'gt' },
  { label: 'is less than', value: 'lt' },
  { label: 'contains', value: 'contains' },
  { label: 'is empty', value: 'empty' },
  { label: 'is not empty', value: 'notEmpty' },
];

const EMPTY_GROUP: ConditionGroup = { logic: 'and', conditions: [] };

export function ConditionEditor({
  condition,
  fieldChoices,
  onChange,
  label = 'Show only when…',
  hint,
}: ConditionEditorProps) {
  const enabled = condition !== undefined;
  const group = condition ?? EMPTY_GROUP;

  const setConditions = (conditions: Condition[]) => onChange({ ...group, conditions });

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          size="small"
          checked={enabled}
          onChange={(checked) =>
            onChange(
              checked
                ? {
                    logic: 'and',
                    conditions: fieldChoices[0]
                      ? [{ field: fieldChoices[0].value, operator: 'eq', value: '' }]
                      : [],
                  }
                : undefined,
            )
          }
        />
        <Typography.Text style={{ fontSize: 13 }}>{label}</Typography.Text>
      </div>

      {!enabled ? null : (
        <>
          {group.conditions.length > 1 ? (
            <Segmented
              size="small"
              value={group.logic}
              options={[
                { label: 'Match all', value: 'and' },
                { label: 'Match any', value: 'or' },
              ]}
              onChange={(logic) => onChange({ ...group, logic: logic as 'and' | 'or' })}
            />
          ) : null}

          {group.conditions.map((item, index) => {
            const unary = UNARY_OPERATORS.includes(item.operator);
            const replace = (patch: Partial<Condition>) =>
              setConditions(
                group.conditions.map((existing, i) =>
                  i === index ? { ...existing, ...patch } : existing,
                ),
              );

            return (
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
                    value={item.field}
                    placeholder="Field"
                    options={fieldChoices}
                    onChange={(field) => replace({ field })}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label="Remove condition"
                    onClick={() => setConditions(group.conditions.filter((_, i) => i !== index))}
                  />
                </div>

                <Select
                  size="small"
                  value={item.operator}
                  options={OPERATOR_OPTIONS}
                  onChange={(operator) => replace({ operator })}
                />

                {unary ? null : (
                  <Input
                    size="small"
                    value={item.value === undefined ? '' : String(item.value)}
                    placeholder={
                      item.operator === 'in' || item.operator === 'notIn'
                        ? 'Comma-separated values'
                        : 'Value'
                    }
                    onChange={(event) => replace({ value: event.target.value })}
                  />
                )}
              </div>
            );
          })}

          <Button
            size="small"
            type="dashed"
            block
            icon={<PlusOutlined />}
            disabled={fieldChoices.length === 0}
            onClick={() =>
              setConditions([
                ...group.conditions,
                { field: fieldChoices[0]?.value ?? '', operator: 'eq', value: '' },
              ])
            }
          >
            Add condition
          </Button>

          {hint ? (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {hint}
            </Typography.Text>
          ) : null}
        </>
      )}
    </Space>
  );
}
