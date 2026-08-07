import { Collapse, Empty, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { metaFor } from '@/schema/registry';
import type { FieldNode } from '@/schema/schema';
import { collectNames, findDuplicateNames, findField, findParent } from '@/schema/walk';
import { useSchemaStore } from '@/store/useSchemaStore';
import { FormSettings } from '../FormSettings';
import { CommonProps } from './CommonProps';
import { ConditionEditor } from './ConditionEditor';
import { OptionsSource } from './OptionsSource';
import { RulesEditor } from './RulesEditor';
import { TypeProps, hasTypeProps } from './TypeProps';

export function Inspector() {
  const schema = useSchemaStore((state) => state.schema);
  const selectedId = useSchemaStore((state) => state.selectedId);
  const updateField = useSchemaStore((state) => state.updateField);

  const selected = useMemo<FieldNode | null>(
    () => (selectedId ? findField(schema.fields, selectedId) : null),
    [schema, selectedId],
  );

  const duplicateNames = useMemo(() => findDuplicateNames(schema.fields), [schema]);

  // A condition may only reference fields in the same row (for list children)
  // or at the top level — plus never the field itself.
  const fieldChoices = useMemo(() => {
    if (!selected) return [];
    const parent = findParent(schema.fields, selected.id);
    const scope = parent?.type === 'list' ? (parent.children ?? []) : schema.fields;
    const inScope = collectNames(scope);
    const topLevel = parent?.type === 'list' ? collectNames(schema.fields) : [];
    const merged = [...inScope, ...topLevel];
    const seen = new Set<string>();
    return merged
      .filter((entry) => {
        if (entry.id === selected.id || seen.has(entry.name)) return false;
        seen.add(entry.name);
        return true;
      })
      .map((entry) => ({ label: `${entry.label} (${entry.name})`, value: entry.name }));
  }, [schema, selected]);

  if (!selected) {
    return (
      <div className="fg-scroll" style={{ height: '100%', padding: 12 }}>
        <FormSettings />
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Select a field to edit it
            </Typography.Text>
          }
          style={{ marginTop: 24 }}
        />
      </div>
    );
  }

  const meta = metaFor(selected.type);
  const onPatch = (patch: Partial<FieldNode>) => updateField(selected.id, patch);

  const items = [
    {
      key: 'general',
      label: 'General',
      children: (
        <CommonProps
          node={selected}
          onPatch={onPatch}
          duplicateName={duplicateNames.includes(selected.name)}
        />
      ),
    },
  ];

  if (meta.supports.options) {
    items.push({
      key: 'options',
      label: 'Options',
      children: (
        <OptionsSource node={selected} onPatch={onPatch} fieldChoices={fieldChoices} />
      ),
    });
  }

  if (hasTypeProps(selected.type)) {
    items.push({
      key: 'settings',
      label: `${meta.label} settings`,
      children: <TypeProps node={selected} onPatch={onPatch} />,
    });
  }

  if (meta.supports.rules) {
    items.push({
      key: 'validation',
      label: 'Validation',
      children: (
        <RulesEditor rules={selected.rules} onChange={(rules) => onPatch({ rules })} />
      ),
    });
  }

  items.push({
    key: 'visibility',
    label: 'Visibility',
    children: (
      <ConditionEditor
        condition={selected.condition}
        fieldChoices={fieldChoices}
        onChange={(condition) => onPatch({ condition })}
      />
    ),
  });

  return (
    <div className="fg-scroll" style={{ height: '100%' }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(5, 5, 5, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Typography.Text strong style={{ fontSize: 13 }}>
          {selected.label || selected.name}
        </Typography.Text>
        <Tag style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>
      </div>
      <Collapse
        ghost
        defaultActiveKey={['general', 'options', 'settings']}
        items={items}
        size="small"
      />
    </div>
  );
}
