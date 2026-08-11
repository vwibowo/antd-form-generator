import { Checkbox, DatePicker, Input, InputNumber, Select, Slider, Switch, TimePicker } from 'antd';
import {
  displayFormatOf,
  isDateRangeFieldType,
  parseDateValue,
  serializeDateValue,
  valueFormatOf,
} from '@/renderer/dateValue';
import { metaFor } from '@/schema/registry';
import type { FieldNode } from '@/schema/schema';
import { Labeled } from './Labeled';

export interface CommonPropsProps {
  node: FieldNode;
  onPatch: (patch: Partial<FieldNode>) => void;
  duplicateName: boolean;
}

const SPAN_PRESETS = [
  { label: 'Full width', value: 24 },
  { label: '1/2', value: 12 },
  { label: '1/3', value: 8 },
  { label: '2/3', value: 16 },
  { label: '1/4', value: 6 },
  { label: '3/4', value: 18 },
];

/** Type-appropriate editor for the field's initial value. */
function DefaultValueInput({ node, onPatch }: { node: FieldNode; onPatch: CommonPropsProps['onPatch'] }) {
  const set = (defaultValue: unknown) => onPatch({ defaultValue });

  switch (node.type) {
    case 'switch':
    case 'checkbox':
      return (
        <Switch
          size="small"
          checked={node.defaultValue === true}
          onChange={(checked) => set(checked)}
        />
      );

    case 'number':
    case 'slider':
    case 'rate':
      return (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          value={typeof node.defaultValue === 'number' ? node.defaultValue : undefined}
          onChange={(value) => set(value ?? undefined)}
        />
      );

    case 'date':
    case 'time':
    case 'dateRange':
    case 'timeRange': {
      // Stored in the field's own `valueFormat` (ISO unless it says otherwise)
      // and converted to dayjs at render time.
      const valueFormat = valueFormatOf(node);
      const format = displayFormatOf(node);
      const write = (value: unknown) => set(serializeDateValue(value, valueFormat) ?? undefined);

      if (isDateRangeFieldType(node.type)) {
        const raw = Array.isArray(node.defaultValue) ? node.defaultValue : [];
        const from = parseDateValue(raw[0], valueFormat) ?? null;
        const to = parseDateValue(raw[1], valueFormat) ?? null;
        // A time range wants clocks, not calendars — otherwise identical.
        const RangeControl =
          node.type === 'timeRange' ? TimePicker.RangePicker : DatePicker.RangePicker;
        return (
          <RangeControl
            size="small"
            style={{ width: '100%' }}
            showTime={node.props?.showTime === true}
            format={format}
            value={from && to ? [from, to] : null}
            onChange={(values) =>
              set(
                values?.[0] && values[1]
                  ? [
                      serializeDateValue(values[0], valueFormat),
                      serializeDateValue(values[1], valueFormat),
                    ]
                  : undefined,
              )
            }
          />
        );
      }

      const parsed = parseDateValue(node.defaultValue, valueFormat) ?? null;
      if (node.type === 'time') {
        return (
          <TimePicker
            size="small"
            style={{ width: '100%' }}
            format={format}
            value={parsed}
            onChange={(value) => write(value)}
          />
        );
      }

      return (
        <DatePicker
          size="small"
          style={{ width: '100%' }}
          showTime={node.props?.showTime === true}
          format={format}
          value={parsed}
          onChange={(value) => write(value)}
        />
      );
    }

    case 'select':
    case 'radio':
      // With a remote source the builder has no option list to pick from — the
      // canvas deliberately does not fetch — so fall back to typing the value.
      if (node.dataSource) {
        return (
          <Input
            size="small"
            placeholder="Value to preselect"
            value={node.defaultValue === undefined ? '' : String(node.defaultValue)}
            onChange={(event) => set(event.target.value || undefined)}
          />
        );
      }
      return (
        <Select
          size="small"
          allowClear
          style={{ width: '100%' }}
          value={node.defaultValue as string | undefined}
          options={node.options ?? []}
          onChange={(value) => set(value ?? undefined)}
        />
      );

    case 'checkboxGroup':
      return (
        <Select
          size="small"
          // Same reason as above: with no option list, values are typed in.
          mode={node.dataSource ? 'tags' : 'multiple'}
          allowClear
          style={{ width: '100%' }}
          value={(Array.isArray(node.defaultValue) ? node.defaultValue : []) as string[]}
          options={node.dataSource ? [] : (node.options ?? [])}
          onChange={(value) => set(value.length > 0 ? value : undefined)}
        />
      );

    default:
      return (
        <Input
          size="small"
          value={node.defaultValue === undefined ? '' : String(node.defaultValue)}
          onChange={(event) => set(event.target.value || undefined)}
        />
      );
  }
}

export function CommonProps({ node, onPatch, duplicateName }: CommonPropsProps) {
  const meta = metaFor(node.type);

  return (
    <>
      {meta.supports.value ? (
        <Labeled
          label="Field name"
          help={
            duplicateName
              ? 'Another field in the same scope uses this name — values will collide.'
              : 'Key this field uses in the submitted JSON.'
          }
          status={duplicateName ? 'warning' : undefined}
        >
          <Input
            size="small"
            value={node.name}
            status={duplicateName ? 'warning' : undefined}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </Labeled>
      ) : null}

      <Labeled label={node.type === 'divider' ? 'Divider text' : 'Label'}>
        <Input
          size="small"
          value={node.label ?? ''}
          onChange={(event) => onPatch({ label: event.target.value })}
        />
      </Labeled>

      <Labeled label={`Width — ${node.span}/24`}>
        <Select
          size="small"
          style={{ width: '100%', marginBottom: 6 }}
          value={SPAN_PRESETS.some((preset) => preset.value === node.span) ? node.span : undefined}
          placeholder="Custom"
          options={SPAN_PRESETS}
          onChange={(span) => onPatch({ span })}
        />
        <Slider min={1} max={24} value={node.span} onChange={(span) => onPatch({ span })} />
      </Labeled>

      {meta.supports.placeholder ? (
        <Labeled label="Placeholder">
          <Input
            size="small"
            value={node.placeholder ?? ''}
            onChange={(event) => onPatch({ placeholder: event.target.value || undefined })}
          />
        </Labeled>
      ) : null}

      {meta.supports.value ? (
        <Labeled label="Tooltip">
          <Input
            size="small"
            value={node.tooltip ?? ''}
            onChange={(event) => onPatch({ tooltip: event.target.value || undefined })}
          />
        </Labeled>
      ) : null}

      <Labeled label="Help text">
        <Input
          size="small"
          value={node.extra ?? ''}
          onChange={(event) => onPatch({ extra: event.target.value || undefined })}
        />
      </Labeled>

      {meta.supports.defaultValue ? (
        <Labeled
          label="Default value"
          help={
            node.dataSource
              ? 'Options load at runtime, so type the raw value to preselect.'
              : undefined
          }
        >
          <DefaultValueInput node={node} onPatch={onPatch} />
        </Labeled>
      ) : null}

      {meta.supports.value ? (
        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
          <Checkbox
            checked={node.disabled}
            onChange={(event) => onPatch({ disabled: event.target.checked })}
          >
            Disabled
          </Checkbox>
          <Checkbox
            checked={node.hidden}
            onChange={(event) => onPatch({ hidden: event.target.checked })}
          >
            Hidden
          </Checkbox>
        </div>
      ) : null}
    </>
  );
}
