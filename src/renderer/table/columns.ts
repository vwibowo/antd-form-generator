import type { TableColumnsType } from 'antd';
import type { TableColumn, TableSchema } from '@/schema/table';
import { compareRows, formatCell } from './cells';

export type TableRow = Record<string, unknown>;

/**
 * Build the antd column list from the document.
 *
 * Hidden columns are dropped here rather than deleted from the document, so a
 * hide is reversible. The antd `key` is the column's builder id — two columns
 * may legitimately point at the same field, and antd needs them distinguishable.
 */
export function buildColumns(
  schema: TableSchema,
  options: { serverSort: boolean },
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
      render: (value: unknown) => formatCell(value, column),
      // Server paging sorts at the source; the browser must not reorder a page.
      sorter: column.sortable
        ? options.serverSort
          ? true
          : (a: TableRow, b: TableRow) => compareRows(a, b, column)
        : undefined,
    }));
}

/** The column a sorter result refers to, looked up by its antd key. */
export function columnById(schema: TableSchema, id: unknown): TableColumn | undefined {
  return schema.columns.find((column) => column.id === id);
}
