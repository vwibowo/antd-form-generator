import { AutoComplete, Checkbox, Input, InputNumber, Select, Tooltip, Typography } from 'antd';
import type { PropSpec } from '@antd-form-generator/core/schema/propSpecs';
import { PROP_GROUPS } from '@antd-form-generator/core/schema/propSpecs';
import { Labeled } from './Labeled';

export interface PropRowProps<Ctx> {
  spec: PropSpec<Ctx>;
  /** Whatever owns the props bag — a field node, a table column, the table. */
  context: Ctx;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * One editable prop, rendered from its spec.
 *
 * Shared by the field inspector and the table builder: both store per-thing
 * antd props in a free-form bag, and both describe what is editable with
 * `PropSpec`, so the control itself only has to exist once.
 */
export function PropRow<Ctx>({ spec, context, value, onChange }: PropRowProps<Ctx>) {
  const locked = spec.lockedWhen?.(context);
  const disabled = locked !== undefined;

  switch (spec.editor.kind) {
    case 'bool': {
      // A locked row is always a forced-on one today — the select's "searchable
      // while the options come from the server" case.
      const checked = disabled
        ? true
        : value === true || (value === undefined && spec.default === true);
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
            value={typeof value === 'string' ? value : ((spec.default as string | undefined) ?? '')}
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
            value={typeof value === 'string' ? value : ((spec.default as string | undefined) ?? '')}
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

export interface PropSectionProps<Ctx> {
  specs: PropSpec<Ctx>[];
  context: Ctx;
  props: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/** Every applicable spec, under Appearance / Behavior / Format subheadings. */
export function PropSection<Ctx>({ specs, context, props, onChange }: PropSectionProps<Ctx>) {
  const applicable = specs.filter((spec) => !spec.when || spec.when(context));

  return (
    <>
      {PROP_GROUPS.map((group) => {
        const rows = applicable.filter((spec) => spec.group === group);
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
                context={context}
                value={props[spec.key]}
                onChange={(value) => onChange(applyProp(props, spec, value))}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

/**
 * Write a prop into a bag, dropping the key when the value is blank or matches
 * the spec's default — a document only carries deliberate deviations, and an
 * absent key keeps following antd if its default ever changes.
 */
export function applyProp<Ctx>(
  props: Record<string, unknown>,
  spec: PropSpec<Ctx>,
  value: unknown,
): Record<string, unknown> {
  const next = { ...props };
  if (value === undefined || value === '' || value === spec.default) {
    delete next[spec.key];
  } else {
    next[spec.key] = value;
  }
  return next;
}
