import dayjs from 'dayjs';
import type { FieldNode, FormSchema } from '@/schema/schema';
import { isPresentationalType, isTransparentContainer } from '@/schema/schema';

/** Types whose default value is authored as an ISO string but consumed as dayjs. */
const DATE_TYPES = new Set(['date', 'time']);

/**
 * Convert an authored `defaultValue` into what the antd control expects.
 * Returns `undefined` when the node has no usable default.
 */
export function toControlDefault(node: FieldNode): unknown {
  const raw = node.defaultValue;
  if (raw === undefined || raw === '') return undefined;

  if (DATE_TYPES.has(node.type)) {
    const parsed = dayjs(String(raw));
    return parsed.isValid() ? parsed : undefined;
  }

  return raw;
}

/** One blank row for a repeatable section, pre-filled with child defaults. */
export function buildRowTemplate(node: FieldNode): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const child of node.children ?? []) {
    if (isPresentationalType(child.type)) continue;
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
export function collectPayloadKeys(schema: FormSchema): Set<string> {
  const keys = new Set<string>();

  const visit = (nodes: FieldNode[]) => {
    for (const node of nodes) {
      if (isPresentationalType(node.type)) continue;
      if (isTransparentContainer(node.type)) {
        visit(node.children ?? []);
        continue;
      }
      keys.add(node.name);
    }
  };

  visit(schema.fields);
  return keys;
}

/**
 * Build the `initialValues` object for the whole form.
 *
 * `group` and `card` are chrome, so their children contribute their names at
 * the top level. `list` contributes an array seeded to `minItems` blank rows.
 */
export function buildInitialValues(schema: FormSchema): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  const visit = (nodes: FieldNode[]) => {
    for (const node of nodes) {
      if (isPresentationalType(node.type)) continue;

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

  visit(schema.fields);
  return values;
}
