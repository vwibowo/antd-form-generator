import { Input, InputNumber, Select } from 'antd';
import type { CustomComponentRegistry } from '@/renderer/custom';
import { customDefFor, customKeyOf, useCustomComponents } from '@/renderer/custom';
import { specsFor } from '@/schema/propSpecs';
import type { ScreenNode } from '@/schema/screen';
import { Labeled } from './Labeled';
import { PropSection } from './PropRow';

export { hasTypeProps } from '@/schema/propSpecs';

export interface TypePropsProps {
  node: ScreenNode;
  onPatch: (patch: Partial<ScreenNode>) => void;
}

/**
 * Per-type antd control options, stored in the node's free-form `props` bag.
 *
 * The rows are not written by hand: `src/schema/propSpecs.ts` describes every
 * editable prop, and this file turns that description into controls. Adding a
 * setting means one spec entry plus one read in `src/renderer/controls.tsx`.
 */
export function TypeProps({ node, onPatch }: TypePropsProps) {
  const customComponents = useCustomComponents();

  // A custom field's rows come from the registered component, not the table.
  const specs =
    node.type === 'custom'
      ? (customDefFor(node, customComponents)?.propSpecs ?? [])
      : specsFor(node.type);

  return (
    <>
      {node.type === 'custom' ? (
        <ComponentPicker node={node} registry={customComponents} onPatch={onPatch} />
      ) : null}

      <PropSection
        specs={specs}
        context={node}
        props={node.props ?? {}}
        onChange={(props) => onPatch({ props })}
      />

      {node.type === 'list' ? <ListSettings node={node} onPatch={onPatch} /> : null}
    </>
  );
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
