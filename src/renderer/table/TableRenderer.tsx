import { Alert, Empty, Table, Typography } from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import { useEffect, useMemo, useState } from 'react';
import type { TableSchema } from '@/schema/table';
import { readPath } from '../remote/mapOptions';
import { buildColumns, columnById, type TableRow } from './columns';
import { useRemoteRows } from './useRemoteRows';

export interface TableRendererProps {
  schema: TableSchema;
}

type Props = Record<string, unknown>;

/** Where the per-row key is stashed. Prefixed so it cannot collide with a field. */
const ROW_KEY = '__rowKey';

function num(props: Props, key: string, fallback?: number): number | undefined {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

function str(props: Props, key: string): string | undefined {
  const value = props[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function bool(props: Props, key: string, fallback = false): boolean {
  const value = props[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** `1200` -> 1200, `max-content` -> itself, blank -> undefined. */
function scrollX(props: Props): number | string | undefined {
  const raw = str(props, 'scrollX');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : raw;
}

/**
 * Renders a `TableSchema` as a working antd table.
 *
 * Like `FormRenderer`, this module and everything it imports are free of
 * builder imports, so `src/renderer/` can be lifted into a standalone package.
 */
export function TableRenderer({ schema }: TableRendererProps) {
  const props = schema.props ?? {};
  const serverPaging = schema.source.kind === 'remote' && schema.source.paging === 'server';

  const configuredPageSize = num(props, 'pageSize', 10) ?? 10;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(configuredPageSize);
  const [sort, setSort] = useState<{ key: string | null; order: 'asc' | 'desc' | null }>({
    key: null,
    order: null,
  });

  // Paging is local state so the reader can move around, but it has to follow
  // the document: editing rows-per-page, or loading a different table into the
  // same builder, must not leave the previous page size in place.
  const sourceKey = `${schema.source.kind}:${schema.source.url}`;
  useEffect(() => {
    setPage(1);
    setPageSize(configuredPageSize);
    setSort({ key: null, order: null });
  }, [configuredPageSize, sourceKey]);

  const remote = useRemoteRows(schema, {
    page,
    pageSize,
    sortKey: sort.key,
    sortOrder: sort.order,
  });

  const source: TableRow[] = schema.source.kind === 'remote' ? remote.rows : schema.source.rows;

  /*
   * antd 6 deprecates the `index` argument of a `rowKey` function — it makes no
   * promise about which index a row gets once sorting and paging are in play.
   * So the key is attached to the row up front, where the position is still
   * unambiguous, and antd is handed a plain field name.
   */
  const rows = useMemo(
    () =>
      source.map((row, index) => {
        const key = schema.rowKey ? readPath(row, schema.rowKey) : undefined;
        return {
          ...row,
          [ROW_KEY]: typeof key === 'string' || typeof key === 'number' ? key : index,
        };
      }),
    [source, schema.rowKey],
  );

  const columns = useMemo(
    () => buildColumns(schema, { serverSort: serverPaging && schema.source.sortParam !== '' }),
    [schema, serverPaging],
  );

  const pagination: TablePaginationConfig | false = bool(props, 'pagination', true)
    ? {
        current: page,
        pageSize,
        // In server mode antd must not slice — the page IS the response.
        total: serverPaging ? (remote.total ?? rows.length + (page - 1) * pageSize) : undefined,
        placement: [(str(props, 'pagePlacement') ?? 'bottomEnd') as 'bottomEnd'],
        showSizeChanger: bool(props, 'showSizeChanger'),
        showQuickJumper: bool(props, 'showQuickJumper'),
        simple: bool(props, 'simplePagination'),
        showTotal: bool(props, 'showTotal')
          ? (total, range) => `${range[0]}–${range[1]} of ${total}`
          : undefined,
      }
    : false;

  const handleChange: TableProps<TableRow>['onChange'] = (nextPagination, _filters, sorter) => {
    setPage(nextPagination.current ?? 1);
    setPageSize(nextPagination.pageSize ?? pageSize);

    const single = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<TableRow> | undefined;
    const column = columnById(schema, single?.columnKey);
    setSort(
      single?.order && column
        ? { key: column.key, order: single.order === 'ascend' ? 'asc' : 'desc' }
        : { key: null, order: null },
    );
  };

  const status = remote.missingParams.length > 0
    ? `Waiting on ${remote.missingParams.join(', ')} — set it under Parameters.`
    : remote.error
      ? `Could not load rows — ${remote.error}`
      : null;

  return (
    <>
      {schema.title ? (
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {schema.title}
        </Typography.Title>
      ) : null}
      {schema.description ? (
        <Typography.Paragraph type="secondary">{schema.description}</Typography.Paragraph>
      ) : null}

      {status ? (
        <Alert
          type={remote.error ? 'error' : 'info'}
          showIcon
          style={{ marginBottom: 12 }}
          title={status}
        />
      ) : null}

      <Table<TableRow>
        columns={columns}
        dataSource={rows}
        rowKey={ROW_KEY}
        loading={remote.loading}
        size={(str(props, 'size') as 'middle' | 'small' | undefined) ?? undefined}
        bordered={bool(props, 'bordered')}
        showHeader={bool(props, 'showHeader', true)}
        sticky={bool(props, 'sticky')}
        tableLayout={str(props, 'tableLayout') === 'fixed' ? 'fixed' : undefined}
        virtual={bool(props, 'virtual') || undefined}
        scroll={{ x: scrollX(props), y: num(props, 'scrollY') }}
        pagination={pagination}
        onChange={handleChange}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={str(props, 'emptyText') ?? 'No data'}
            />
          ),
        }}
      />
    </>
  );
}
