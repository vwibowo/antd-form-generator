import type { FieldNode, FormSchema } from '@/schema/schema';
import { isPresentationalType, isTransparentContainer } from '@/schema/schema';
import type { CustomComponentRegistry } from './custom';
import { customDefFor } from './custom';
import { isDateFieldType, serializeDateField } from './dateValue';

/**
 * Turn the live form values into the submitted payload.
 *
 * Two kinds of field need a conversion on the way out: dates, which leave antd
 * as dayjs objects and land in whatever `valueFormat` asks for, and custom
 * components, which may hold anything and get their own `serialize` hook.
 *
 * Walks the schema rather than the values, so nothing else is touched — upload
 * file lists, tag arrays and plain objects come back exactly as they went in.
 * Mirrors the traversal in `initialValues.ts`: transparent containers flatten,
 * a `list` recurses once per row.
 */
export function serializeValues(
  schema: FormSchema,
  values: Record<string, unknown>,
  registry?: CustomComponentRegistry,
): Record<string, unknown> {
  const out = { ...values };
  applyNodes(schema.fields, out, registry);
  return out;
}

function applyNodes(
  nodes: FieldNode[],
  target: Record<string, unknown>,
  registry: CustomComponentRegistry | undefined,
): void {
  for (const node of nodes) {
    if (isPresentationalType(node.type)) continue;

    if (isTransparentContainer(node.type)) {
      applyNodes(node.children ?? [], target, registry);
      continue;
    }

    if (node.type === 'list') {
      const rows = target[node.name];
      if (!Array.isArray(rows)) continue;
      target[node.name] = rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const copy = { ...(row as Record<string, unknown>) };
        applyNodes(node.children ?? [], copy, registry);
        return copy;
      });
      continue;
    }

    if (!(node.name in target)) continue;

    if (isDateFieldType(node.type)) {
      target[node.name] = serializeDateField(node, target[node.name]);
      continue;
    }

    if (node.type === 'custom') {
      const serialize = customDefFor(node, registry)?.serialize;
      // A component that never registered a hook keeps whatever it stored —
      // most custom values are already plain strings, numbers or arrays.
      if (serialize) target[node.name] = serialize(target[node.name], node);
    }
  }
}
