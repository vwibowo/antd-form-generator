import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Table, Typography } from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { TableSchema } from '@/schema/table';
import { readPath } from '../remote/mapOptions';
import { useDebouncedValue } from '../remote/useDebouncedValue';
import { buildColumns, columnById, type TableRow } from './columns';
import { rowMatches, searchableColumns } from './search';
import { useRemoteRows } from './useRemoteRows';

export interface TableRendererProps {
  schema: TableSchema;
  /**
   * Rows the reader picked. A table submits nothing, so this is how a host app
   * finds out what was chosen.
   */
  onSelectionChange?: (keys: Key[], rows: TableRow[]) => void;
  /**
   * A bulk action button was pressed. The document only carries the action's
   * id and label — what it means belongs to the host.
   */
  onAction?: (actionId: string, keys: Key[], rows: TableRow[]) => void;
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
export function TableRenderer({ schema, onSelectionChange, onAction }: TableRendererProps) {
  const props = schema.props ?? {};
  const serverPaging = schema.source.kind === 'remote' && schema.source.paging === 'server';

  const configuredPageSize = num(props, 'pageSize', 10) ?? 10;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(configuredPageSize);
  const [sort, setSort] = useState<{ key: string | null; order: 'asc' | 'desc' | null }>({
    key: null,
    order: null,
  });
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  // Paging is local state so the reader can move around, but it has to follow
  // the document: editing rows-per-page, or loading a different table into the
  // same builder, must not leave the previous page size, search or selection
  // in place.
  const sourceKey = `${schema.source.kind}:${schema.source.url}`;
  useEffect(() => {
    setPage(1);
    setPageSize(configuredPageSize);
    setSort({ key: null, order: null });
    setTerm('');
    setFilters({});
    setSelectedKeys([]);
  }, [configuredPageSize, sourceKey]);

  // One request per pause in typing, not one per keystroke.
  const settledTerm = useDebouncedValue(term, schema.search.debounceMs);

  const remoteFilters = useMemo(
    () =>
      schema.columns
        .filter((column) => column.filterable && (filters[column.id]?.length ?? 0) > 0)
        .map((column) => ({
          param: column.filterParam || column.key,
          values: filters[column.id] ?? [],
        })),
    [schema.columns, filters],
  );

  const remote = useRemoteRows(schema, {
    page,
    pageSize,
    sortKey: sort.key,
    sortOrder: sort.order,
    search: serverPaging ? settledTerm : '',
    filters: serverPaging ? remoteFilters : [],
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

  // In client mode the search runs here, before antd sees the array; column
  // filters stay antd's job, so its own filter UI keeps telling the truth.
  const visibleRows = useMemo(() => {
    if (serverPaging || !schema.search.enabled || settledTerm.trim() === '') return rows;
    const searched = searchableColumns(schema.columns, schema.search.columnIds);
    return rows.filter((row) => rowMatches(row, settledTerm, searched));
  }, [rows, serverPaging, schema.search.enabled, schema.search.columnIds, schema.columns, settledTerm]);

  const columns = useMemo(
    () =>
      buildColumns(schema, {
        serverSort: serverPaging && schema.source.sortParam !== '',
        serverFilter: serverPaging,
        rows,
        filters,
      }),
    [schema, serverPaging, rows, filters],
  );

  // Narrowing the set can strand the reader on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [settledTerm, filters]);

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

  const handleChange: TableProps<TableRow>['onChange'] = (nextPagination, nextFilters, sorter) => {
    setPage(nextPagination.current ?? 1);
    setPageSize(nextPagination.pageSize ?? pageSize);

    const single = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<TableRow> | undefined;
    const column = columnById(schema, single?.columnKey);
    setSort(
      single?.order && column
        ? { key: column.key, order: single.order === 'ascend' ? 'asc' : 'desc' }
        : { key: null, order: null },
    );

    // antd reports the chosen filters keyed by column key — which is the
    // column's builder id here, since that is what `buildColumns` sets.
    const nextState: Record<string, string[]> = {};
    for (const [columnId, values] of Object.entries(nextFilters ?? {})) {
      if (Array.isArray(values) && values.length > 0) {
        nextState[columnId] = values.map((value) => String(value));
      }
    }
    setFilters(nextState);
  };

  const selection = schema.selection;
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedKeys.includes(row[ROW_KEY] as Key)),
    [rows, selectedKeys],
  );

  const rowSelection: TableProps<TableRow>['rowSelection'] = selection.enabled
    ? {
        type: selection.type,
        selectedRowKeys: selectedKeys,
        preserveSelectedRowKeys: selection.preserveAcrossPages,
        hideSelectAll: selection.hideSelectAll,
        fixed: selection.fixed,
        columnWidth: selection.columnWidth,
        onChange: (keys, pickedRows) => {
          setSelectedKeys(keys);
          onSelectionChange?.(keys, pickedRows);
        },
      }
    : undefined;

  const clearSelection = () => {
    setSelectedKeys([]);
    onSelectionChange?.([], []);
  };

  const showToolbar = schema.search.enabled || (selection.enabled && selection.actions.length > 0);

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

      {showToolbar || (selection.enabled && selectedKeys.length > 0) ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          {schema.search.enabled ? (
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={schema.search.placeholder || 'Search'}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              style={{ maxWidth: 280 }}
            />
          ) : null}

          <div style={{ flex: 1 }} />

          {selection.enabled && selectedKeys.length > 0 ? (
            <>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {selectedKeys.length} selected
              </Typography.Text>
              <Button type="link" size="small" onClick={clearSelection}>
                Clear
              </Button>
            </>
          ) : null}

          {selection.enabled
            ? selection.actions.map((action) => (
                <Button
                  key={action.id}
                  size="small"
                  danger={action.danger}
                  // An action that needs two rows says so by staying disabled,
                  // rather than failing once the host has already been called.
                  disabled={selectedKeys.length < action.minSelected}
                  onClick={() => onAction?.(action.id, selectedKeys, selectedRows)}
                >
                  {action.label}
                </Button>
              ))
            : null}
        </div>
      ) : null}

      <Table<TableRow>
        columns={columns}
        dataSource={visibleRows}
        rowKey={ROW_KEY}
        rowSelection={rowSelection}
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
