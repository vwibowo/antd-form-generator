import { parseDateValue } from '../dateValue';
import { formatNumber } from '../numberFormat';
import { readPath } from '../remote/mapOptions';
import type { TableColumn } from '@/schema/table';

/** Shown for a value the row does not have, or one that cannot be read. */
export const EMPTY_CELL = '—';

type Props = Record<string, unknown>;

function str(props: Props, key: string): string | undefined {
  const value = props[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Render one cell's value as text, per the column's declarative format.
 *
 * `render` is a function and cannot live in a JSON document, so the document
 * carries a format name plus options and the closure is built here. Nothing
 * throws: an unparseable date or a number that is not one falls back to the raw
 * value, so one bad row cannot take down the table.
 */
export function formatCell(value: unknown, column: TableColumn): string {
  if (value === undefined || value === null || value === '') return EMPTY_CELL;
  const props = column.props ?? {};

  switch (column.format) {
    case 'number': {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return String(value);
      const text = formatNumber(numeric, {
        precision: typeof props.precision === 'number' ? props.precision : undefined,
        thousandSeparator: str(props, 'thousandSeparator'),
        decimalSeparator: str(props, 'decimalSeparator'),
      });
      return `${str(props, 'prefix') ?? ''}${text}${str(props, 'suffix') ?? ''}`;
    }

    case 'date': {
      const parsed = parseDateValue(value, str(props, 'sourceFormat'));
      if (!parsed) return String(value);
      return parsed.format(str(props, 'format') ?? 'YYYY-MM-DD');
    }

    case 'boolean': {
      const truthy = typeof value === 'string' ? value !== 'false' : Boolean(value);
      return truthy ? (str(props, 'trueText') ?? 'Yes') : (str(props, 'falseText') ?? 'No');
    }

    default:
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
  }
}

/** Client-side sort, matching the column's format rather than raw JS ordering. */
export function compareRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  column: TableColumn,
): number {
  const left = readPath(a, column.key);
  const right = readPath(b, column.key);

  // Blanks sort last in both directions, which is what a reader expects.
  const leftBlank = left === undefined || left === null || left === '';
  const rightBlank = right === undefined || right === null || right === '';
  if (leftBlank || rightBlank) return leftBlank && rightBlank ? 0 : leftBlank ? 1 : -1;

  switch (column.format) {
    case 'number':
      return Number(left) - Number(right);

    case 'date': {
      const sourceFormat = str(column.props ?? {}, 'sourceFormat');
      const leftDate = parseDateValue(left, sourceFormat);
      const rightDate = parseDateValue(right, sourceFormat);
      if (!leftDate || !rightDate) return 0;
      return leftDate.valueOf() - rightDate.valueOf();
    }

    case 'boolean':
      return Number(Boolean(left)) - Number(Boolean(right));

    default:
      return String(left).localeCompare(String(right));
  }
}
