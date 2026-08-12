import type { ScreenNode, ScreenSchema } from '../schema/screen';
import { isDisplayType, isTransparentContainer } from '../schema/screen';
import {
  isDateType,
  isDateRangeType,
  parseDateValue,
  valueFormatOf,
} from './dateValue';

/**
 * Turn a submitted payload back into values a live form can hold — the inverse
 * of `serializeValues`.
 *
 * Needed wherever a payload re-enters a form rather than leaving one: a
 * workflow that loops back to a step already answered hands over what
 * `onSubmit` produced, and a date in there is an ISO string, while antd's
 * DatePicker will only accept a dayjs object.
 *
 * Walks the schema rather than the values, exactly as `serializeValues` does,
 * so nothing else is touched. `custom` fields pass through unchanged: a
 * component declares `serialize` but nothing to reverse it, and the values that
 * hook produces are almost always the shape the control already held. A
 * component that serialises into something it cannot read back needs its own
 * round trip, and this is where that would go.
 */
export function hydrateValues(
  schema: ScreenSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...values };
  applyNodes(schema.nodes, out);
  return out;
}

function applyNodes(nodes: ScreenNode[], target: Record<string, unknown>): void {
  for (const node of nodes) {
    if (isDisplayType(node.type)) continue;

    if (isTransparentContainer(node.type)) {
      applyNodes(node.children ?? [], target);
      continue;
    }

    if (node.type === 'list') {
      const rows = target[node.name];
      if (!Array.isArray(rows)) continue;
      target[node.name] = rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const copy = { ...(row as Record<string, unknown>) };
        applyNodes(node.children ?? [], copy);
        return copy;
      });
      continue;
    }

    if (!(node.name in target)) continue;

    if (isDateType(node.type)) {
      const valueFormat = valueFormatOf(node);
      const raw = target[node.name];

      if (isDateRangeType(node.type)) {
        if (!Array.isArray(raw)) continue;
        const range = raw.map((entry) => parseDateValue(entry, valueFormat));
        // A half-parsed range would put the picker in a state it cannot show,
        // so an unusable pair is dropped rather than partly restored.
        target[node.name] = range.length === 2 && range.every(Boolean) ? range : undefined;
        continue;
      }

      target[node.name] = parseDateValue(raw, valueFormat);
    }
  }
}
