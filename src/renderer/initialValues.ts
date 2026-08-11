import type { ScreenNode, ScreenSchema } from '@/schema/screen';
import { isDisplayType, isTransparentContainer } from '@/schema/screen';
import {
  isDateType,
  isDateRangeType,
  parseDateValue,
  valueFormatOf,
} from './dateValue';

/**
 * Convert an authored `defaultValue` into what the antd control expects.
 * Returns `undefined` when the node has no usable default.
 */
export function toControlDefault(node: ScreenNode): unknown {
  const raw = node.defaultValue;
  if (raw === undefined || raw === '') return undefined;

  if (isDateType(node.type)) {
    // Authored in the field's own `valueFormat` — ISO unless it says otherwise.
    const valueFormat = valueFormatOf(node);
    if (isDateRangeType(node.type)) {
      if (!Array.isArray(raw)) return undefined;
      const range = raw.map((entry) => parseDateValue(entry, valueFormat));
      return range.length === 2 && range.every(Boolean) ? range : undefined;
    }
    return parseDateValue(raw, valueFormat);
  }

  return raw;
}

/** One blank row for a repeatable section, pre-filled with child defaults. */
export function buildRowTemplate(node: ScreenNode): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const child of node.children ?? []) {
    if (isDisplayType(child.type)) continue;
    const value = toControlDefault(child);
    if (value !== undefined) row[child.name] = value;
  }
  return row;
}

/**
 * Top-level keys this schema can produce in a submitted payload.
 * `group` and `card` are chrome, so their children contribute their own names
 * here rather than nesting under the container.
 */
export function collectPayloadKeys(schema: ScreenSchema): Set<string> {
  const keys = new Set<string>();

  const visit = (nodes: ScreenNode[]) => {
    for (const node of nodes) {
      if (isDisplayType(node.type)) continue;
      if (isTransparentContainer(node.type)) {
        visit(node.children ?? []);
        continue;
      }
      keys.add(node.name);
    }
  };

  visit(schema.nodes);
  return keys;
}

/**
 * Build the `initialValues` object for the whole form.
 *
 * `group` and `card` are chrome, so their children contribute their names at
 * the top level. `list` contributes an array seeded to `minItems` blank rows.
 */
export function buildInitialValues(schema: ScreenSchema): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  const visit = (nodes: ScreenNode[]) => {
    for (const node of nodes) {
      if (isDisplayType(node.type)) continue;

      if (isTransparentContainer(node.type)) {
        visit(node.children ?? []);
        continue;
      }

      if (node.type === 'list') {
        const min = node.listConfig?.minItems ?? 0;
        if (min > 0) {
          const template = buildRowTemplate(node);
          values[node.name] = Array.from({ length: min }, () => ({ ...template }));
        }
        continue;
      }

      const value = toControlDefault(node);
      if (value !== undefined) values[node.name] = value;
    }
  };

  visit(schema.nodes);
  return values;
}
