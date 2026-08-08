import { AutoComplete, Checkbox, Input, InputNumber, Select, Tooltip, Typography } from 'antd';
import type { CustomComponentRegistry } from '@/renderer/custom';
import { customDefFor, customKeyOf, useCustomComponents } from '@/renderer/custom';
import type { PropSpec } from '@/schema/propSpecs';
import { PROP_GROUPS, specsFor } from '@/schema/propSpecs';
import type { FieldNode } from '@/schema/schema';
import { Labeled } from './Labeled';

export { hasTypeProps } from '@/schema/propSpecs';

export interface TypePropsProps {
  node: FieldNode;
  onPatch: (patch: Partial<FieldNode>) => void;
}

/**
 * Per-type antd control options, stored in the node's free-form `props` bag.
 *
 * The rows are not written by hand: `src/schema/propSpecs.ts` describes every
 * editable prop, and this file turns that description into controls. Adding a
 * setting means one spec entry plus one read in `src/renderer/controls.tsx`.
 */
export function TypeProps({ node, onPatch }: TypePropsProps) {
  const props = node.props ?? {};
  const customComponents = useCustomComponents();

  const setProp = (key: string, value: unknown) => {
    const next = { ...props };
    if (value === undefined || value === '') {
      delete next[key];
    } else {
      next[key] = value;
    }
    onPatch({ props: next });
  };

  // A custom field's rows come from the registered component, not the table.
  const declared =
    node.type === 'custom'
      ? (customDefFor(node, customComponents)?.propSpecs ?? [])
      : specsFor(node.type);
  const specs = declared.filter((spec) => !spec.when || spec.when(node));

  return (
    <>
      {node.type === 'custom' ? (
        <ComponentPicker node={node} registry={customComponents} onPatch={onPatch} />
      ) : null}

      {PROP_GROUPS.map((group) => {
        const rows = specs.filter((spec) => spec.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} style={{ marginBottom: 4 }}>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 10,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 8,
              }}
            >
              {group}
            </Typography.Text>
            {rows.map((spec) => (
              <PropRow
                key={spec.key}
                spec={spec}
                node={node}
                value={props[spec.key]}
                // Storing the default would only bloat the JSON — and a prop
                // that is absent keeps following antd if the default changes.
                onChange={(value) => setProp(spec.key, value === spec.default ? undefined : value)}
              />
            ))}
          </div>
        );
      })}

      {node.type === 'list' ? <ListSettings node={node} onPatch={onPatch} /> : null}
    </>
  );
}

interface PropRowProps {
  spec: PropSpec;
  node: FieldNode;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PropRow({ spec, node, value, onChange }: PropRowProps) {
  const locked = spec.lockedWhen?.(node);
  const disabled = locked !== undefined;

  switch (spec.editor.kind) {
    case 'bool': {
      const checked = disabled ? true : value === true || (value === undefined && spec.default === true);
      const checkbox = (
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        >
          {spec.label}
        </Checkbox>
      );
      return (
        <div style={{ marginBottom: 12 }}>
          {locked ? <Tooltip title={locked}>{checkbox}</Tooltip> : checkbox}
          {spec.help ? (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, display: 'block', marginTop: 4 }}
            >
              {spec.help}
            </Typography.Text>
          ) : null}
        </div>
      );
    }

    case 'text':
      return (
        <Labeled label={spec.label} help={spec.help}>
          <Input
            size="small"
            disabled={disabled}
            placeholder={spec.editor.placeholder}
            value={typeof value === 'string' ? value : (spec.default as string | undefined) ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        </Labeled>
      );

    case 'number':
      return (
        <Labeled label={spec.label} help={spec.help}>
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            disabled={disabled}
            min={spec.editor.min}
            max={spec.editor.max}
            step={spec.editor.step}
            value={typeof value === 'number' ? value : (spec.default as number | undefined)}
            onChange={(next) => onChange(next ?? undefined)}
          />
        </Labeled>
      );

    case 'select':
      return (
        <Labeled label={spec.label} help={spec.help}>
          <Select
            size="small"
            style={{ width: '100%' }}
            disabled={disabled}
            value={value ?? spec.default}
            options={spec.editor.options}
            onChange={(next) => onChange(next)}
          />
        </Labeled>
      );

    case 'combo':
      // Presets plus anything typed — date patterns cannot be enumerated.
      return (
        <Labeled label={spec.label} help={spec.help}>
          <AutoComplete
            size="small"
            style={{ width: '100%' }}
            disabled={disabled}
            allowClear
            placeholder={spec.editor.placeholder}
            value={typeof value === 'string' ? value : (spec.default as string | undefined) ?? ''}
            options={spec.editor.options.map((option) => ({
              label: option.label,
              value: String(option.value),
            }))}
            onChange={(next) => onChange(next ?? undefined)}
          />
        </Labeled>
      );

    default:
      return null;
  }
}

/**
 * Which host component this field renders. The list is whatever the app
 * registered, so a schema authored elsewhere can name something unavailable
 * here — that stays selected and is called out rather than silently dropped.
 */
function ComponentPicker({
  node,
  registry,
  onPatch,
}: TypePropsProps & { registry: CustomComponentRegistry }) {
  const current = customKeyOf(node);
  const known = Object.keys(registry);
  const missing = current !== undefined && !known.includes(current);

  return (
    <Labeled
      label="Component"
      help={missing ? `"${current}" is not registered in this app.` : undefined}
      status={missing ? 'warning' : undefined}
    >
      <Select
        size="small"
        style={{ width: '100%' }}
        status={missing ? 'warning' : undefined}
        placeholder="Choose a component"
        value={current}
        options={[
          ...known.map((key) => ({ label: registry[key].label, value: key })),
          ...(missing ? [{ label: `${current} (missing)`, value: current }] : []),
        ]}
        onChange={(value) => onPatch({ props: { ...(node.props ?? {}), component: value } })}
      />
    </Labeled>
  );
}

/** Repeatable rows are configured through `listConfig`, not the `props` bag. */
function ListSettings({ node, onPatch }: TypePropsProps) {
  const config = node.listConfig ?? { addText: 'Add item' };
  const patchConfig = (patch: Partial<typeof config>) =>
    onPatch({ listConfig: { ...config, ...patch } });

  return (
    <>
      <Labeled label="Add button text">
        <Input
          size="small"
          value={config.addText ?? 'Add item'}
          onChange={(event) => patchConfig({ addText: event.target.value })}
        />
      </Labeled>
      <Labeled label="Minimum rows" help="Rows created automatically and not removable.">
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          value={config.minItems}
          onChange={(value) => patchConfig({ minItems: value ?? undefined })}
        />
      </Labeled>
      <Labeled label="Maximum rows">
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={1}
          value={config.maxItems}
          onChange={(value) => patchConfig({ maxItems: value ?? undefined })}
        />
      </Labeled>
    </>
  );
}
