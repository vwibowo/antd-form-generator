import type { SelectOption } from '@/schema/screen';

/**
 * Turn an arbitrary JSON response into `SelectOption[]`.
 * Nothing in here throws: a misconfigured path or an unexpected shape yields an
 * empty list, never a crashed preview.
 */

/** A response big enough to lock the tab is a configuration mistake, not data. */
const MAX_OPTIONS = 1000;

/** Read a dot path out of parsed JSON. A blank path returns the input. */
export function readPath(body: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (trimmed === '') return body;

  let current: unknown = body;
  for (const segment of trimmed.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export interface OptionMapping {
  dataPath: string;
  labelKey: string;
  valueKey: string;
}

function isUsableValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

export function mapToOptions(body: unknown, mapping: OptionMapping): SelectOption[] {
  const list = readPath(body, mapping.dataPath);
  if (!Array.isArray(list)) return [];

  const options: SelectOption[] = [];
  for (const item of list.slice(0, MAX_OPTIONS)) {
    // A bare `["red", "green"]` response is common enough to support directly.
    if (isUsableValue(item)) {
      options.push({ label: String(item), value: item });
      continue;
    }
    if (item === null || typeof item !== 'object') continue;

    const value = readPath(item, mapping.valueKey);
    if (!isUsableValue(value)) continue;

    const label = readPath(item, mapping.labelKey);
    options.push({
      label: isUsableValue(label) ? String(label) : String(value),
      value,
    });
  }
  return options;
}
