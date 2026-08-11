import type { Condition, ConditionGroup } from '@/schema/screen';

export type NamePath = (string | number)[];

/**
 * Read `path` out of a nested values object.
 * `found` distinguishes "key is absent" from "key holds undefined", which is
 * what lets scoped lookups fall back to the root scope correctly.
 */
function resolvePath(values: unknown, path: NamePath): { found: boolean; value: unknown } {
  let current: unknown = values;
  for (const segment of path) {
    if (current === null || current === undefined) return { found: false, value: undefined };
    if (Array.isArray(current)) {
      const index = typeof segment === 'number' ? segment : Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') return { found: false, value: undefined };
    const record = current as Record<string, unknown>;
    if (!(String(segment) in record)) return { found: false, value: undefined };
    current = record[String(segment)];
  }
  return { found: true, value: current };
}

/**
 * Look up the field a condition references.
 *
 * Inside a `Form.List` row, `scopePath` is `[listName, rowIndex]`, so a
 * condition naming a sibling resolves within its own row first. Anything not
 * present in the row falls back to the top level, letting a row field also
 * depend on a form-level field.
 */
export function resolveConditionValue(
  field: string,
  values: unknown,
  scopePath: NamePath = [],
): unknown {
  if (scopePath.length > 0) {
    const scoped = resolvePath(values, [...scopePath, field]);
    if (scoped.found) return scoped.value;
  }
  return resolvePath(values, [field]).value;
}

/** Shared by conditions and by remote-URL dependency resolution. */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Forgiving equality. Option values authored in the builder are often strings
 * ("1") while the control yields a number (1); a strict compare would silently
 * break conditions that look correct in the UI.
 */
function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === typeof b) return false;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return String(a) === String(b);
  }
  return String(a) === String(b);
}

/** Coerce a condition's authored `value` into a list for `in` / `notIn`. */
function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
  if (value === null || value === undefined) return [];
  return [value];
}

export function evaluateSingle(
  condition: Condition,
  values: unknown,
  scopePath: NamePath = [],
): boolean {
  const actual = resolveConditionValue(condition.field, values, scopePath);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':
      return looseEquals(actual, expected);
    case 'neq':
      return !looseEquals(actual, expected);
    case 'in':
      return toList(expected).some((item) => looseEquals(actual, item));
    case 'notIn':
      return !toList(expected).some((item) => looseEquals(actual, item));
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'contains':
      if (Array.isArray(actual)) {
        return actual.some((item) => looseEquals(item, expected));
      }
      if (typeof actual === 'string') {
        return actual.toLowerCase().includes(String(expected ?? '').toLowerCase());
      }
      return false;
    case 'empty':
      return isEmpty(actual);
    case 'notEmpty':
      return !isEmpty(actual);
    default:
      return true;
  }
}

/**
 * Whether a node with this condition group should render.
 * An absent or empty group means "always visible".
 */
export function evaluateCondition(
  group: ConditionGroup | undefined,
  values: unknown,
  scopePath: NamePath = [],
): boolean {
  if (!group || group.conditions.length === 0) return true;
  const results = group.conditions.map((condition) =>
    evaluateSingle(condition, values, scopePath),
  );
  return group.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
}
