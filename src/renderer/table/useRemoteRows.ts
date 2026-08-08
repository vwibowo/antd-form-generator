import { useMemo } from 'react';
import type { TableSchema } from '@/schema/table';
import { readPath } from '../remote/mapOptions';
import { resolveUrlTemplate, withSearchParam } from '../remote/url';
import { useFetchedBody } from '../remote/useFetchedBody';
import type { TableRow } from './columns';

export interface RowQuery {
  /** 1-based, as antd's pagination reports it. */
  page: number;
  pageSize: number;
  /** Dot path of the column being sorted, or null. */
  sortKey: string | null;
  sortOrder: 'asc' | 'desc' | null;
}

export interface RemoteRowsState {
  /** True only when this document genuinely has a usable remote source. */
  active: boolean;
  rows: TableRow[];
  /** Row count reported by the server; undefined when no `totalPath` is set. */
  total: number | undefined;
  loading: boolean;
  error: string | null;
  /** `{{tokens}}` with no value in `params` — the request is not firing. */
  missingParams: string[];
}

const IDLE: RemoteRowsState = {
  active: false,
  rows: [],
  total: undefined,
  loading: false,
  error: null,
  missingParams: [],
};

/**
 * Fetch a table's rows.
 *
 * The counterpart to `useRemoteOptions`, sharing its URL templating and its
 * fetch/cache/abort layer. Two differences: tokens resolve against the
 * document's own `params` rather than live form values, and in `server` paging
 * mode the page, size and sort become query parameters, so every page change
 * is a fresh request.
 */
export function useRemoteRows(schema: TableSchema, query: RowQuery): RemoteRowsState {
  const source = schema.source;
  const active = source.kind === 'remote' && source.url.trim() !== '';

  // Primitives only: the store clones the document on every keystroke, so an
  // object in this dependency list would refire the request constantly.
  const paramsKey = JSON.stringify(schema.params);
  const serverPaging = active && source.paging === 'server';

  const resolved = useMemo(
    () => (active ? resolveUrlTemplate(source.url, (field) => schema.params[field]) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey stands in for `params`
    [active, source.url, paramsKey],
  );

  const requestUrl = useMemo(() => {
    if (!resolved || resolved.missing.length > 0) return null;
    if (!serverPaging) return resolved.url;

    // `withSearchParam` is the same URL-safe setter the option search uses; it
    // returns null for a URL that does not parse rather than throwing.
    const offset =
      source.pageMode === 'offset'
        ? (query.page - 1) * query.pageSize
        : query.page - 1 + source.pageStart;

    let url = withSearchParam(resolved.url, source.pageParam, String(offset));
    if (url) url = withSearchParam(url, source.sizeParam, String(query.pageSize));
    if (url && source.sortParam && query.sortKey && query.sortOrder) {
      url = withSearchParam(url, source.sortParam, query.sortKey);
      if (url) {
        url = withSearchParam(
          url,
          source.orderParam,
          query.sortOrder === 'asc' ? source.ascValue : source.descValue,
        );
      }
    }
    return url;
  }, [
    resolved,
    serverPaging,
    source.pageMode,
    source.pageParam,
    source.sizeParam,
    source.pageStart,
    source.sortParam,
    source.orderParam,
    source.ascValue,
    source.descValue,
    query.page,
    query.pageSize,
    query.sortKey,
    query.sortOrder,
  ]);

  const state = useFetchedBody(active ? requestUrl : null);

  // Separate from the fetch: editing `dataPath` in the builder re-reads the
  // cached body rather than issuing a second request.
  const rows = useMemo(() => {
    if (!active) return [];
    const list = readPath(state.body, source.dataPath);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (row): row is TableRow => typeof row === 'object' && row !== null && !Array.isArray(row),
    );
  }, [active, state.body, source.dataPath]);

  const total = useMemo(() => {
    if (!active || !source.totalPath) return undefined;
    const value = readPath(state.body, source.totalPath);
    return typeof value === 'number' ? value : undefined;
  }, [active, state.body, source.totalPath]);

  if (!active) return IDLE;

  return {
    active: true,
    rows,
    total,
    loading: state.loading,
    error: state.error,
    missingParams: resolved?.missing ?? [],
  };
}
