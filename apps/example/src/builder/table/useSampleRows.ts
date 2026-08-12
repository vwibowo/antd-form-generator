import type { TableSchema } from '@antd-form-generator/core/schema/table';
import type { TableRow } from '@antd-form-generator/core/renderer/table/columns';
import { useRemoteRows } from '@antd-form-generator/core/renderer/table/useRemoteRows';

export interface SampleRows {
  rows: TableRow[];
  loading: boolean;
}

/**
 * The rows the builder reasons about: what "Detect columns" reads, and what the
 * column Field picker lists paths from.
 *
 * For a remote source this asks for the same first page the preview does, so
 * the body comes out of the cache instead of costing a second request.
 */
export function useSampleRows(schema: TableSchema): SampleRows {
  const previewPageSize = typeof schema.props?.pageSize === 'number' ? schema.props.pageSize : 10;

  const remote = useRemoteRows(schema, {
    page: 1,
    pageSize: previewPageSize,
    sortKey: null,
    sortOrder: null,
    // Unnarrowed on purpose: the builder wants the shape of the data, not
    // whatever the reader happens to have filtered it down to.
    search: '',
    filters: [],
  });

  if (schema.source.kind === 'remote') {
    return { rows: remote.rows, loading: remote.loading };
  }
  return { rows: schema.source.rows, loading: false };
}
