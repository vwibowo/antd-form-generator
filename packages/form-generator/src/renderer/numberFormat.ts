/**
 * `InputNumber` takes `formatter`/`parser` functions, which have no place in a
 * shared JSON file — a schema that carried code would have to be evaluated to
 * render. So the schema carries two separators instead, and the pair of
 * functions is derived here.
 *
 * Currency symbols and units are NOT part of this: they go through the
 * `prefix`/`suffix` props, which keeps the form value a plain number and leaves
 * the `min`/`max` validation rules working.
 */

type Props = Record<string, unknown>;

export interface NumberFormatters {
  formatter?: (value: string | number | undefined, info: { userTyping: boolean; input: string }) => string;
  parser?: (displayValue: string | undefined) => string;
}

function separator(props: Props, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value : '';
}

/** Insert `sep` every three digits, right to left. */
function group(digits: string, sep: string): string {
  if (!sep) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export interface NumberFormatOptions {
  /** Fixed decimal places. Left alone when absent. */
  precision?: number;
  thousandSeparator?: string;
  decimalSeparator?: string;
}

/**
 * Render a number as text. Shared by the `InputNumber` formatter below and by
 * table cells, so a value reads the same whether it is being edited or shown.
 */
export function formatNumber(value: unknown, options: NumberFormatOptions): string {
  if (value === undefined || value === null || value === '') return '';

  const numeric = Number(value);
  const raw =
    options.precision !== undefined && Number.isFinite(numeric)
      ? numeric.toFixed(options.precision)
      : String(value);

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart = '', fractionPart] = unsigned.split('.');
  const decimalMark = options.decimalSeparator || '.';
  const formatted =
    group(intPart, options.thousandSeparator ?? '') +
    (fractionPart !== undefined ? decimalMark + fractionPart : '');
  return negative ? `-${formatted}` : formatted;
}

/**
 * Returns `{}` when neither separator is configured, so an untouched field keeps
 * antd's own behaviour rather than round-tripping through our string handling.
 */
export function numberFormatters(props: Props): NumberFormatters {
  const thousand = separator(props, 'thousandSeparator');
  const decimal = separator(props, 'decimalSeparator');
  if (!thousand && !decimal) return {};

  return {
    formatter: (value, info) => {
      // While the user is typing, leave the text exactly as entered — otherwise
      // a half-finished "1234." loses its trailing separator on every keystroke.
      if (info?.userTyping) return info.input;

      // antd applies `precision` to its own display string, which the formatter
      // replaces — so pad the decimals here too, or `1250.5` shows as `1,250.5`
      // in a field configured for two decimals.
      return formatNumber(value, {
        precision: typeof props.precision === 'number' ? props.precision : undefined,
        thousandSeparator: thousand,
        decimalSeparator: decimal,
      });
    },

    parser: (displayValue) => {
      if (!displayValue) return '';
      let text = displayValue;
      if (thousand) text = text.split(thousand).join('');
      if (decimal) text = text.split(decimal).join('.');
      // Drop anything else the user pasted in — prefix/suffix text included.
      return text.replace(/[^0-9.-]/g, '');
    },
  };
}
