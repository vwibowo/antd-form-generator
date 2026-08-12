/**
 * antd's `ColorPicker` holds a `Color` object, not a string.
 *
 * The one type in this app whose live value is neither JSON-native nor a dayjs,
 * so it gets its own tiny conversion pair rather than widening `dateValue.ts`.
 * A hex string is what the payload carries, because that is what a stylesheet,
 * an API and a human all understand.
 */

/** Shape of the parts of antd's `Color` this module relies on. */
interface AntdColor {
  toHexString: () => string;
  toRgbString?: () => string;
  toHsbString?: () => string;
}

function isAntdColor(value: unknown): value is AntdColor {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AntdColor).toHexString === 'function'
  );
}

/**
 * `Color` -> a CSS string. Anything already a string passes through, so a
 * payload that has been round-tripped once stays stable.
 */
export function serializeColorValue(value: unknown, format?: string): unknown {
  if (!isAntdColor(value)) return value;
  if (format === 'rgb' && value.toRgbString) return value.toRgbString();
  if (format === 'hsb' && value.toHsbString) return value.toHsbString();
  return value.toHexString();
}

/**
 * A CSS string is exactly what `ColorPicker` accepts as a value, so reading one
 * back needs no conversion — only the empty case has to become `undefined`, or
 * the picker renders black for "nothing chosen".
 */
export function parseColorValue(raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === '') return undefined;
  return raw;
}
