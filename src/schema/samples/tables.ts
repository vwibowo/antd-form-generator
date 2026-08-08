import { createId } from '@/lib/ids';
import type { TableSchema } from '../table';
import { tableSchemaSchema } from '../table';

/**
 * Demo table documents, offered by the Sample button in table mode. Same shape
 * as the form presets in `index.ts`.
 */
export interface TableSamplePreset {
  key: string;
  label: string;
  description: string;
  create: () => TableSchema;
}

const INLINE_ROWS = [
  { id: 'INV-1041', customer: 'Ada Lovelace', total: 1250.5, paid: true, issued: '2026-03-01' },
  { id: 'INV-1042', customer: 'Grace Hopper', total: 98, paid: false, issued: '2026-03-04' },
  { id: 'INV-1043', customer: 'Alan Turing', total: 24999.99, paid: true, issued: '2026-03-11' },
  { id: 'INV-1044', customer: 'Katherine Johnson', total: 430.25, paid: false, issued: '2026-04-02' },
  { id: 'INV-1045', customer: 'Edsger Dijkstra', total: 7600, paid: true, issued: '2026-04-19' },
];

export const inlineTablePreset: TableSamplePreset = {
  key: 'inline-invoices',
  label: 'Inline array',
  description: 'Rows pasted straight into the document — one column per cell format.',
  create: (): TableSchema =>
    tableSchemaSchema.parse({
      title: 'Invoices',
      description: 'An array authored inline, paged and sorted in the browser.',
      rowKey: 'id',
      source: { kind: 'static', rows: INLINE_ROWS },
      props: { bordered: true, size: 'middle', pageSize: 5, showTotal: true },
      columns: [
        { id: createId('col'), key: 'id', title: 'Invoice', width: 120, sortable: true },
        { id: createId('col'), key: 'customer', title: 'Customer', sortable: true },
        {
          id: createId('col'),
          key: 'total',
          title: 'Total',
          align: 'right',
          width: 140,
          sortable: true,
          format: 'number',
          props: { prefix: '$', precision: 2, thousandSeparator: ',' },
        },
        {
          id: createId('col'),
          key: 'issued',
          title: 'Issued',
          width: 130,
          sortable: true,
          format: 'date',
          props: { format: 'DD/MM/YYYY' },
        },
        {
          id: createId('col'),
          key: 'paid',
          title: 'Status',
          width: 110,
          align: 'center',
          format: 'boolean',
          props: { trueText: 'Paid', falseText: 'Outstanding' },
        },
      ],
    }),
};

export const remoteTablePreset: TableSamplePreset = {
  key: 'remote-products',
  label: 'API list',
  description: 'A GET that returns a list, paged on the server via limit/skip.',
  create: (): TableSchema =>
    tableSchemaSchema.parse({
      title: 'Products',
      description:
        'dummyjson.com returns { products, total }. It takes an offset rather than a page number, which is what `Row offset` in the data panel is for.',
      rowKey: 'id',
      source: {
        kind: 'remote',
        url: 'https://dummyjson.com/products',
        dataPath: 'products',
        paging: 'server',
        pageMode: 'offset',
        pageParam: 'skip',
        sizeParam: 'limit',
        totalPath: 'total',
        sortParam: 'sortBy',
        orderParam: 'order',
      },
      props: { size: 'small', pageSize: 10, showTotal: true, scrollX: 'max-content' },
      columns: [
        { id: createId('col'), key: 'id', title: 'ID', width: 70, align: 'right' },
        { id: createId('col'), key: 'title', title: 'Product', sortable: true, width: 220 },
        { id: createId('col'), key: 'brand', title: 'Brand', width: 140 },
        {
          id: createId('col'),
          key: 'price',
          title: 'Price',
          align: 'right',
          width: 110,
          sortable: true,
          format: 'number',
          props: { prefix: '$', precision: 2 },
        },
        {
          id: createId('col'),
          key: 'rating',
          title: 'Rating',
          align: 'right',
          width: 90,
          format: 'number',
          props: { precision: 1 },
        },
        {
          id: createId('col'),
          key: 'description',
          title: 'Description',
          width: 320,
          ellipsis: true,
        },
      ],
    }),
};

export const TABLE_SAMPLE_PRESETS: TableSamplePreset[] = [inlineTablePreset, remoteTablePreset];

/** What a plain click on the Sample button loads in table mode. */
export const DEFAULT_TABLE_PRESET = inlineTablePreset;
