import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { ScreenNode, ScreenNodeType } from '@/schema/screen';

// Needed to read a default value back from a custom pattern like `DD/MM/YYYY`.
dayjs.extend(customParseFormat);

/**
 * Two formats live on a date field:
 *
 * - `props.format`     — display only, handed straight to antd.
 * - `props.valueFormat` — what the submitted JSON carries, and how an authored
 *                         default value is read back.
 *
 * `valueFormat` is either one of the keywords below or any dayjs pattern.
 * Absent means ISO 8601, which is what this app emitted before the prop existed.
 */
export const VALUE_FORMAT_KEYWORDS = ['iso', 'timestamp', 'unix'] as const;

/** Types whose value is a dayjs object (or a pair of them). */
export const DATE_TYPES = new Set<ScreenNodeType>([
  'date',
  'dateRange',
  'time',
  'timeRange',
]);

/** Types whose value is a *pair* of dayjs objects rather than one. */
export const DATE_RANGE_TYPES = new Set<ScreenNodeType>(['dateRange', 'timeRange']);

export function isDateRangeType(type: ScreenNodeType): boolean {
  return DATE_RANGE_TYPES.has(type);
}

export function isDateType(type: ScreenNodeType): boolean {
  return DATE_TYPES.has(type);
}

export function valueFormatOf(node: ScreenNode): string | undefined {
  const value = node.props?.valueFormat;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function displayFormatOf(node: ScreenNode): string | undefined {
  const value = node.props?.format;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function isPattern(valueFormat: string | undefined): valueFormat is string {
  return (
    valueFormat !== undefined &&
    !(VALUE_FORMAT_KEYWORDS as readonly string[]).includes(valueFormat)
  );
}

/** JSON (default value, imported data) → dayjs. Returns undefined if unusable. */
export function parseDateValue(raw: unknown, valueFormat?: string): Dayjs | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (dayjs.isDayjs(raw)) return raw.isValid() ? raw : undefined;

  if (typeof raw === 'number') {
    const parsed = valueFormat === 'unix' ? dayjs.unix(raw) : dayjs(raw);
    return parsed.isValid() ? parsed : undefined;
  }

  const text = String(raw);
  if (isPattern(valueFormat)) {
    const parsed = dayjs(text, valueFormat);
    if (parsed.isValid()) return parsed;
    // Fall through: a schema authored before the pattern was set still holds ISO.
  }

  const parsed = dayjs(text);
  return parsed.isValid() ? parsed : undefined;
}

/** dayjs → JSON. Non-dayjs values pass through untouched. */
export function serializeDateValue(value: unknown, valueFormat?: string): unknown {
  if (!dayjs.isDayjs(value) || !value.isValid()) return value;
  if (valueFormat === 'timestamp') return value.valueOf();
  if (valueFormat === 'unix') return value.unix();
  if (isPattern(valueFormat)) return value.format(valueFormat);
  return value.toISOString();
}

/** dayjs → JSON for one field, honouring `dateRange`'s two-element value. */
export function serializeDateField(node: ScreenNode, value: unknown): unknown {
  const valueFormat = valueFormatOf(node);
  if (isDateRangeType(node.type) && Array.isArray(value)) {
    return value.map((entry) => serializeDateValue(entry, valueFormat));
  }
  return serializeDateValue(value, valueFormat);
}
