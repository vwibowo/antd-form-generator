import type { TableColumnsType } from 'antd';
import type React from 'react';
import type { TableColumn, TableSchema } from '../../schema/table';
import { collectFilterValues } from '../../schema/table';
import { readPath } from '../remote/mapOptions';
import { compareRows, formatCell } from './cells';

export type TableRow = Record<string, unknown>;

/**
 * Build the antd column list from the document.
 *
 * Hidden columns are dropped here rather than deleted from the document, so a
 * hide is reversible. The antd `key` is the column's builder id — two columns
 * may legitimately point at the same field, and antd needs them distinguishable.
 */
export interface BuildColumnsOptions {
  /** Sorting happens at the source; the browser must not reorder a page. */
  serverSort: boolean;
  /** Same for filtering: antd shows the dropdown but does not apply it. */
  serverFilter: boolean;
  /** Rows the filter lists are derived from. */
  rows: TableRow[];
  /** Chosen filter values, keyed by column id. */
  filters: Record<string, string[]>;
}

export function buildColumns(
  schema: TableSchema,
  options: BuildColumnsOptions,
): TableColumnsType<TableRow> {
  return schema.columns
    .filter((column) => !column.hidden)
    .map((column) => ({
      key: column.id,
      title: column.title || column.key,
      // An array path is how antd reads a nested value, e.g. `user.name`.
      dataIndex: column.key.includes('.') ? column.key.split('.') : column.key,
      width: column.width,
      align: column.align,
      fixed: column.fixed,
      ellipsis: column.ellipsis,
      // Read from the record rather than antd's resolved `dataIndex` value, so
      // the cell and `compareRows` — which also uses `readPath` — cannot
      // disagree about what a path means. Indexed array segments are exactly
      // where two resolvers would drift.
      //
      // A blank path is guarded because `readPath` treats it as "the whole
      // object": a column that has not been pointed at anything yet would
      // otherwise dump the entire row into every cell.
      render: (_value: unknown, record: TableRow) =>
        formatCell(column.key ? readPath(record, column.key) : undefined, column),
      // Server paging sorts at the source; the browser must not reorder a page.
      sorter: column.sortable
        ? options.serverSort
          ? true
          : (a: TableRow, b: TableRow) => compareRows(a, b, column)
        : undefined,
      ...filterProps(column, options),
    }));
}

/**
 * The header filter dropdown for one column.
 *
 * The values are derived from the rows in hand rather than authored, so the
 * list cannot drift from the data. Labels go through `formatCell`, which is
 * what makes the dropdown read like the column it filters — `Paid` rather than
 * `true`, `$1,250.50` rather than `1250.5`.
 */
function filterProps(column: TableColumn, options: BuildColumnsOptions) {
  if (!column.filterable || !column.key) return {};

  const values = collectFilterValues(options.rows, column.key);
  const chosen = options.filters[column.id] ?? [];

  return {
    filters: values.map((value) => ({
      text: formatCell(value, column),
      value: String(value),
    })),
    // Controlled, so the dropdown keeps showing the choice after a refetch.
    filteredValue: chosen.length > 0 ? chosen : null,
    // Long lists get a search box rather than a wall of checkboxes.
    filterSearch: values.length > 10,
    // Omitted under server paging: the response IS the filtered set, and a
    // second pass in the browser would hide rows the server deliberately sent.
    onFilter: options.serverFilter
      ? undefined
      : (value: React.Key | boolean, record: TableRow) =>
          String(readPath(record, column.key) ?? '') === String(value),
  };
}

/** The column a sorter result refers to, looked up by its antd key. */
export function columnById(schema: TableSchema, id: unknown): TableColumn | undefined {
  return schema.columns.find((column) => column.id === id);
}
