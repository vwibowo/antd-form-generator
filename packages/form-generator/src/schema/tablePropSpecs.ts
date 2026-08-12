import type { PropOption, PropSpec } from './propSpecs';
import type { CellFormat, TableColumn } from './table';

/**
 * Editable antd `Table` props, and the per-format options a column cell takes.
 *
 * Same declarative shape the form fields use (`propSpecs.ts`), so both render
 * through the one `PropRow` editor. Only props with a JSON representation are
 * here: `rowSelection`, `expandable`, `summary`, `components`, `onCell` and
 * `rowClassName` are functions or nodes and have no place in a shared document.
 */

const SIZE_OPTIONS: PropOption[] = [
  { label: 'Default', value: '' },
  { label: 'Middle', value: 'middle' },
  { label: 'Small', value: 'small' },
];

// antd 6 renamed these from `position` (left/right) to `placement` (start/end).
const PAGINATION_PLACEMENTS: PropOption[] = [
  { label: 'Bottom end', value: '' },
  { label: 'Bottom start', value: 'bottomStart' },
  { label: 'Bottom centre', value: 'bottomCenter' },
  { label: 'Top end', value: 'topEnd' },
  { label: 'Top start', value: 'topStart' },
  { label: 'Top centre', value: 'topCenter' },
];

const paginationOn = (props: Record<string, unknown>) => props.pagination !== false;

export const TABLE_PROP_SPECS: PropSpec<Record<string, unknown>>[] = [
  {
    key: 'size',
    label: 'Row height',
    group: 'Appearance',
    editor: { kind: 'select', options: SIZE_OPTIONS },
    default: '',
  },
  { key: 'bordered', label: 'Show cell borders', group: 'Appearance', editor: { kind: 'bool' }, default: false },
  { key: 'showHeader', label: 'Show the header row', group: 'Appearance', editor: { kind: 'bool' }, default: true },
  {
    key: 'sticky',
    label: 'Sticky header',
    group: 'Appearance',
    editor: { kind: 'bool' },
    default: false,
    help: 'Header stays visible while the page scrolls.',
  },
  {
    key: 'tableLayout',
    label: 'Column widths',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Automatic', value: '' },
        { label: 'Fixed (respect widths)', value: 'fixed' },
      ],
    },
    default: '',
  },
  {
    key: 'scrollX',
    label: 'Horizontal scroll',
    group: 'Appearance',
    editor: {
      kind: 'combo',
      options: [
        { label: 'Off', value: '' },
        { label: 'Fit the content', value: 'max-content' },
        { label: '1200px', value: '1200' },
      ],
      placeholder: 'Off',
    },
    default: '',
    help: 'A pixel width, or "max-content" to size to the columns.',
  },
  {
    key: 'scrollY',
    label: 'Body height (px)',
    group: 'Appearance',
    editor: { kind: 'number', min: 80 },
    help: 'Scrolls the rows under a fixed header.',
  },
  {
    key: 'emptyText',
    label: 'Empty message',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: 'No data' },
  },
  {
    key: 'virtual',
    label: 'Virtual scrolling',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    help: 'For very long lists. Needs a body height and fixed column widths.',
  },
  { key: 'pagination', label: 'Paginate', group: 'Behavior', editor: { kind: 'bool' }, default: true },
  {
    key: 'pageSize',
    label: 'Rows per page',
    group: 'Behavior',
    editor: { kind: 'number', min: 1 },
    default: 10,
    when: paginationOn,
  },
  {
    key: 'pagePlacement',
    label: 'Pager position',
    group: 'Behavior',
    editor: { kind: 'select', options: PAGINATION_PLACEMENTS },
    default: '',
    when: paginationOn,
  },
  {
    key: 'showSizeChanger',
    label: 'Let the reader change the page size',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    when: paginationOn,
  },
  {
    key: 'showQuickJumper',
    label: 'Show the jump-to-page box',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    when: paginationOn,
  },
  {
    key: 'showTotal',
    label: 'Show the row count',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    when: paginationOn,
  },
  {
    key: 'simplePagination',
    label: 'Compact pager',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    when: paginationOn,
  },
];

/* -------------------------------------------------------------------------- */
/* Per-format cell options                                                     */
/* -------------------------------------------------------------------------- */

const numberSpecs: PropSpec<TableColumn>[] = [
  { key: 'prefix', label: 'Prefix', group: 'Format', editor: { kind: 'text', placeholder: 'e.g. $' } },
  { key: 'suffix', label: 'Suffix', group: 'Format', editor: { kind: 'text', placeholder: 'e.g. kg' } },
  { key: 'precision', label: 'Decimal places', group: 'Format', editor: { kind: 'number', min: 0 } },
  {
    key: 'thousandSeparator',
    label: 'Thousands separator',
    group: 'Format',
    editor: {
      kind: 'select',
      options: [
        { label: 'None', value: '' },
        { label: 'Comma — 1,234', value: ',' },
        { label: 'Dot — 1.234', value: '.' },
        { label: 'Space — 1 234', value: ' ' },
      ],
    },
    default: '',
  },
  {
    key: 'decimalSeparator',
    label: 'Decimal separator',
    group: 'Format',
    editor: {
      kind: 'select',
      options: [
        { label: 'Dot — 1.5', value: '' },
        { label: 'Comma — 1,5', value: ',' },
      ],
    },
    default: '',
  },
];

const dateSpecs: PropSpec<TableColumn>[] = [
  {
    key: 'format',
    label: 'Display format',
    group: 'Format',
    editor: {
      kind: 'combo',
      options: [
        { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
        { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
        { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
        { label: 'D MMM YYYY', value: 'D MMM YYYY' },
        { label: 'DD/MM/YYYY HH:mm', value: 'DD/MM/YYYY HH:mm' },
      ],
      placeholder: 'YYYY-MM-DD',
    },
    default: '',
    help: 'Any dayjs pattern.',
  },
  {
    key: 'sourceFormat',
    label: 'Incoming format',
    group: 'Format',
    editor: {
      kind: 'combo',
      options: [
        { label: 'Detect (ISO 8601)', value: '' },
        { label: 'Unix timestamp (ms)', value: 'timestamp' },
        { label: 'Unix timestamp (seconds)', value: 'unix' },
        { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
      ],
      placeholder: 'Detect',
    },
    default: '',
    help: 'How the raw value in the data is written.',
  },
];

const booleanSpecs: PropSpec<TableColumn>[] = [
  { key: 'trueText', label: 'Text when true', group: 'Format', editor: { kind: 'text', placeholder: 'Yes' } },
  { key: 'falseText', label: 'Text when false', group: 'Format', editor: { kind: 'text', placeholder: 'No' } },
];

export const COLUMN_FORMAT_SPECS: Record<CellFormat, PropSpec<TableColumn>[]> = {
  text: [],
  number: numberSpecs,
  date: dateSpecs,
  boolean: booleanSpecs,
};

export function specsForFormat(format: CellFormat): PropSpec<TableColumn>[] {
  return COLUMN_FORMAT_SPECS[format] ?? [];
}
