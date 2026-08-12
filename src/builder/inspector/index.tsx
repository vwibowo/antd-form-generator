import { Collapse, Empty, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { metaFor } from '@/schema/registry';
import type { ScreenNode, ScreenSchema } from '@/schema/screen';
import { isDisplayType } from '@/schema/screen';
import { collectNames, findDuplicateNames, findNode, findParent } from '@/schema/walk';
import { useBuilderStore } from '@/store/ScreenStoreContext';
import { FormSettings } from '../FormSettings';
import { CommonProps } from './CommonProps';
import { ConditionEditor } from './ConditionEditor';
import { DisplayProps, EmbeddedTableEditor } from './DisplayProps';
import { OptionsSource } from './OptionsSource';
import { RulesEditor } from './RulesEditor';
import { TreeOptionsEditor } from './TreeOptionsEditor';
import { TypeProps, hasTypeProps } from './TypeProps';

export interface InspectorProps {
  /**
   * Payload keys a condition or a `{{token}}` can reach beyond this screen.
   * Supplied when the screen sits inside a workflow; empty otherwise, which is
   * why `ConditionEditor` has to accept a typed name.
   */
  fieldChoices?: { label: string; value: string }[];
  /** Earlier screen steps a `summary` node can lay out, when inside a workflow. */
  formSources?: Record<string, ScreenSchema>;
  /** Labels for those steps, so the picker reads as node names not ids. */
  formLabels?: Record<string, string>;
}

export function Inspector({
  fieldChoices: workflowChoices,
  formSources = {},
  formLabels = {},
}: InspectorProps = {}) {
  const schema = useBuilderStore((state) => state.schema);
  const selectedId = useBuilderStore((state) => state.selectedId);
  const updateNode = useBuilderStore((state) => state.updateNode);

  const selected = useMemo<ScreenNode | null>(
    () => (selectedId ? findNode(schema.nodes, selectedId) : null),
    [schema, selectedId],
  );

  const duplicateNames = useMemo(() => findDuplicateNames(schema.nodes), [schema]);

  // A condition may only reference fields in the same row (for list children)
  // or at the top level — plus never the field itself.
  const fieldChoices = useMemo(() => {
    if (!selected) return [];
    const parent = findParent(schema.nodes, selected.id);
    const scope = parent?.type === 'list' ? (parent.children ?? []) : schema.nodes;
    const inScope = collectNames(scope);
    const topLevel = parent?.type === 'list' ? collectNames(schema.nodes) : [];
    const merged = [...inScope, ...topLevel];
    const seen = new Set<string>();
    return merged
      .filter((entry) => {
        if (entry.id === selected.id || seen.has(entry.name)) return false;
        seen.add(entry.name);
        return true;
      })
      .map((entry) => ({ label: `${entry.label} (${entry.name})`, value: entry.name }))
      // Keys collected by earlier steps are just as testable as this screen's
      // own, and a standalone screen simply has none to add.
      .concat(workflowChoices ?? []);
  }, [schema, selected, workflowChoices]);

  if (!selected) {
    return (
      <div className="fg-scroll" style={{ height: '100%', padding: 12 }}>
        <FormSettings />
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Select a node to edit it
            </Typography.Text>
          }
          style={{ marginTop: 24 }}
        />
      </div>
    );
  }

  const meta = metaFor(selected.type);
  const onPatch = (patch: Partial<ScreenNode>) => updateNode(selected.id, patch);

  const items = [
    {
      key: 'general',
      label: 'General',
      children: !isDisplayType(selected.type) ? (
        // Anything that is not a display node — a control, or a container.
        // `CommonProps` gates `name`, rules and defaults on the registry's
        // `supports.value`, so a container gets the label and width it needs
        // without the payload settings it cannot use.
        //
        // Deliberately not `collectsValue`: that is false for `card`, `group`
        // and `tabs` too, and gating on it hid the Label input for every
        // container — which is the only way to title a card or name a tab.
        <CommonProps
          node={selected}
          onPatch={onPatch}
          duplicateName={duplicateNames.includes(selected.name)}
        />
      ) : (
        <>
          <DisplayProps
            node={selected}
            onPatch={onPatch}
            formSources={formSources}
            formLabels={formLabels}
          />
          <CommonProps
            node={selected}
            onPatch={onPatch}
            duplicateName={false}
            layoutOnly
          />
        </>
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

  // Exclusive with the flat editor above: a type has one shape of options or
  // the other, never both.
  if (meta.supports.treeOptions) {
    items.push({
      key: 'treeOptions',
      label: 'Options',
      children: (
        <TreeOptionsEditor
          options={selected.treeOptions ?? []}
          onChange={(treeOptions) => onPatch({ treeOptions })}
        />
      ),
    });
  }

  if (meta.supports.table) {
    items.push({
      key: 'table',
      label: 'Table',
      children: <EmbeddedTableEditor node={selected} onPatch={onPatch} />,
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
        // Outside a workflow a screen has nothing but its own fields to offer,
        // so the field must stay typeable or the editor is unusable there.
        allowCustomField={fieldChoices.length === 0}
        hint="Inside a repeatable section, a condition matches the field in the same row first, then falls back to the top level."
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
          {selected.label || selected.name || meta.label}
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
