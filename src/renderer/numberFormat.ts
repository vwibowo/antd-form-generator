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

/**
 * Returns `{}` when neither separator is configured, so an untouched field keeps
 * antd's own behaviour rather than round-tripping through our string handling.
 */
export function numberFormatters(props: Props): NumberFormatters {
  const thousand = separator(props, 'thousandSeparator');
  const decimal = separator(props, 'decimalSeparator');
  if (!thousand && !decimal) return {};

  const decimalMark = decimal || '.';

  return {
    formatter: (value, info) => {
      // While the user is typing, leave the text exactly as entered — otherwise
      // a half-finished "1234." loses its trailing separator on every keystroke.
      if (info?.userTyping) return info.input;
      if (value === undefined || value === null || value === '') return '';

      // antd applies `precision` to its own display string, which the formatter
      // replaces — so pad the decimals here too, or `1250.5` shows as `1,250.5`
      // in a field configured for two decimals.
      const precision = typeof props.precision === 'number' ? props.precision : undefined;
      const numeric = Number(value);
      const raw =
        precision !== undefined && Number.isFinite(numeric)
          ? numeric.toFixed(precision)
          : String(value);
      const negative = raw.startsWith('-');
      const unsigned = negative ? raw.slice(1) : raw;
      const [intPart = '', fractionPart] = unsigned.split('.');
      const formatted =
        group(intPart, thousand) + (fractionPart !== undefined ? decimalMark + fractionPart : '');
      return negative ? `-${formatted}` : formatted;
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
