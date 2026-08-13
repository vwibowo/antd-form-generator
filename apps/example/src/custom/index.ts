import { BgColorsOutlined, TableOutlined } from '@ant-design/icons';
import { Space } from 'antd';
import { createElement } from 'react';
import type { CustomComponentRegistry } from '@antd-form-generator/core/renderer/custom';
import { ColorField } from './ColorField';
import { KeyValueField, type KeyValueRow } from './KeyValueField';

/**
 * The app's own component registry — two demos of the extension point.
 *
 * A real host swaps this for its own map and passes it to `FormRenderer`
 * (or a surrounding `CustomComponentsProvider`). Nothing here is reachable
 * from a schema except by name: `props.component` selects an entry, and an
 * unknown name renders a notice instead of anything executable.
 */
export const appCustomComponents: CustomComponentRegistry = {
  colorPicker: {
    label: 'Colour',
    component: ColorField,
    icon: createElement(BgColorsOutlined),
    defaults: { label: 'Brand colour', namePrefix: 'colour' },
    // A hex string tells a reader nothing on its own — show the colour itself.
    summary: (value: string) =>
      createElement(
        Space,
        { size: 8 },
        createElement('span', {
          style: {
            display: 'inline-block',
            width: 14,
            height: 14,
            borderRadius: 4,
            background: value,
            border: '1px solid rgba(5, 5, 5, 0.15)',
          },
        }),
        createElement(
          'span',
          { style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } },
          value,
        ),
      ),
    propSpecs: [
      {
        key: 'showText',
        label: 'Show the hex value',
        group: 'Appearance',
        editor: { kind: 'bool' },
        default: false,
      },
      {
        key: 'size',
        label: 'Size',
        group: 'Appearance',
        editor: {
          kind: 'select',
          options: [
            { label: 'Default', value: '' },
            { label: 'Large', value: 'large' },
          ],
        },
        default: '',
      },
    ],
  },

  keyValue: {
    label: 'Key / value pairs',
    component: KeyValueField,
    icon: createElement(TableOutlined),
    defaults: { label: 'Metadata', namePrefix: 'metadata' },
    // `min`/`max` rules on this field mean "how many pairs".
    valueKind: 'array',
    // The control works on an array; the payload reads better as an object.
    serialize: (rows: KeyValueRow[]) =>
      Array.isArray(rows)
        ? Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]))
        : rows,
    // And back, or the reshape above is one-way: `KeyValueField` guards with
    // `Array.isArray(value) ? value : []`, so an object handed back to it reads
    // as no pairs at all. A workflow looping to a step already answered would
    // show the field empty.
    deserialize: (value): KeyValueRow[] => {
      if (Array.isArray(value)) return value as KeyValueRow[];
      if (!value || typeof value !== 'object') return [];
      return Object.entries(value as Record<string, unknown>).map(([key, entry]) => ({
        key,
        value: String(entry ?? ''),
      }));
    },
    // Reached with the serialised object in a summary built from a payload, and
    // with the live array when a host passes raw form values — accept both.
    summary: (value: KeyValueRow[] | Record<string, unknown>) => {
      const pairs: [string, string][] = Array.isArray(value)
        ? value.filter((row) => row?.key).map((row) => [row.key, String(row.value ?? '')])
        : Object.entries(value ?? {}).map(([key, entry]) => [key, String(entry ?? '')]);
      if (pairs.length === 0) return null;

      return createElement(
        Space,
        { orientation: 'vertical', size: 2 },
        ...pairs.map(([key, entry]) =>
          createElement('span', { key }, `${key}: ${entry}`),
        ),
      );
    },
    propSpecs: [
      {
        key: 'keyPlaceholder',
        label: 'Key placeholder',
        group: 'Appearance',
        editor: { kind: 'text', placeholder: 'Key' },
      },
      {
        key: 'valuePlaceholder',
        label: 'Value placeholder',
        group: 'Appearance',
        editor: { kind: 'text', placeholder: 'Value' },
      },
      {
        key: 'maxRows',
        label: 'Max pairs',
        group: 'Behavior',
        editor: { kind: 'number', min: 1 },
      },
    ],
  },
};
