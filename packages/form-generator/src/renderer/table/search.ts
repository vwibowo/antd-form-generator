import type { TableColumn } from '../../schema/table';
import { readPath } from '../remote/mapOptions';
import { formatCell } from './cells';
import type { TableRow } from './columns';

/**
 * Does this row match the search term?
 *
 * Matching is against the **rendered** text, not the raw value: a boolean
 * column showing `Paid` is found by searching "paid", and a number shown as
 * `$1,250.50` is found by searching "1,250". What the reader can see is what
 * the box searches — anything else looks broken from the outside.
 */
export function rowMatches(row: TableRow, term: string, columns: TableColumn[]): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === '') return true;

  return columns.some((column) => {
    if (!column.key) return false;
    const value = readPath(row, column.key);
    if (value === undefined || value === null) return false;
    return formatCell(value, column).toLowerCase().includes(needle);
  });
}

/** The columns a search covers: the chosen subset, or every visible one. */
export function searchableColumns(columns: TableColumn[], columnIds: string[]): TableColumn[] {
  const visible = columns.filter((column) => !column.hidden);
  if (columnIds.length === 0) return visible;
  return visible.filter((column) => columnIds.includes(column.id));
}
