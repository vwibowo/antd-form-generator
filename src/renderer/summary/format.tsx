import { Rate, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { FieldNode, SelectOption, TreeOption } from '@/schema/schema';
import type { CustomComponentRegistry } from '../custom';
import { customDefFor } from '../custom';
import { displayFormatOf, parseDateValue, valueFormatOf } from '../dateValue';
import { formatNumber } from '../numberFormat';

/**
 * Turn one submitted value into what a reader should see.
 *
 * The counterpart of `renderControl`: that maps a node to an editable control,
 * this maps a node plus its value to read-only output. Every key read out of
 * `node.props` here is one the matching control already honours, so a field
 * reads the same on the summary page as it did in the form.
 *
 * Nothing throws. An unparseable date or a number that is not one falls back to
 * the raw text, so one odd value cannot take down the page.
 */

/** Shown for a value that was never filled in. */
export const EMPTY_VALUE = '—';

/** A password is never printed on a confirmation page. Fixed width: the real length is not a hint worth giving. */
const MASK = '••••••••';

type Props = Record<string, unknown>;

function str(props: Props, key: string): string | undefined {
  const value = props[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function num(props: Props, key: string): number | undefined {
  const value = props[key];
  return typeof value === 'number' ? value : undefined;
}

/** `undefined`, `null`, `''` and `[]` all mean "not filled in". `false` and `0` do not. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}

export function blankText(): ReactNode {
  return <Typography.Text type="secondary">{EMPTY_VALUE}</Typography.Text>;
}

/**
 * Option values are authored as strings ("1") but a control may yield a number
 * (1) — the same forgiving compare the condition evaluator makes.
 */
function labelFor(value: unknown, options: SelectOption[] | undefined): string {
  const match = options?.find((option) => String(option.value) === String(value));
  return match ? match.label : String(value);
}

/**
 * Labels for a cascader path or a tree select's value.
 *
 * A cascader submits the whole path (`['a','a1']`), so each entry is resolved
 * one level deeper than the last. A tree select submits leaf values that may
 * sit anywhere, so those are looked up across the whole tree. Both cases fall
 * back to the raw value, which is what keeps a stale option list readable.
 */
function treeLabels(value: unknown, treeOptions: TreeOption[]): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  if (values.length === 0) return [];

  const findDeep = (options: TreeOption[], target: unknown): TreeOption | undefined => {
    for (const option of options) {
      if (String(option.value) === String(target)) return option;
      const nested = option.children ? findDeep(option.children, target) : undefined;
      if (nested) return nested;
    }
    return undefined;
  };

  // Try the value as a path first: every step found at successive depths.
  let level = treeOptions;
  const path: string[] = [];
  for (const entry of values) {
    const match = level.find((option) => String(option.value) === String(entry));
    if (!match) break;
    path.push(match.label);
    level = match.children ?? [];
  }
  if (path.length === values.length) return path;

  return values.map((entry) => findDeep(treeOptions, entry)?.label ?? String(entry));
}

function tagList(values: unknown[], options: SelectOption[] | undefined): ReactNode {
  return (
    <Space size={[4, 4]} wrap>
      {values.map((entry, index) => (
        // Values in one list are unique in practice, but the index keeps a
        // duplicate from collapsing two tags into one.
        <Tag key={`${String(entry)}-${index}`} style={{ marginInlineEnd: 0 }}>
          {labelFor(entry, options)}
        </Tag>
      ))}
    </Space>
  );
}

/**
 * What to show when the field authored no display `format`. Follows the
 * picker's granularity, so a year picker does not print a day it never asked
 * for. Week and quarter patterns need dayjs plugins this app does not load, so
 * both fall back to a plain date.
 */
function defaultDateFormat(props: Props): string {
  switch (str(props, 'picker')) {
    case 'month':
      return 'YYYY-MM';
    case 'year':
      return 'YYYY';
    default:
      return props.showTime === true ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  }
}

/** dates arrive as whatever `valueFormat` produced; show them in the field's display format. */
function dateText(node: FieldNode, value: unknown, fallbackFormat: string): string {
  const parsed = parseDateValue(value, valueFormatOf(node));
  if (!parsed) return String(value);
  return parsed.format(displayFormatOf(node) ?? fallbackFormat);
}

function fileNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (entry && typeof entry === 'object') {
      const file = entry as { name?: string; uid?: string };
      return file.name ?? file.uid ?? 'file';
    }
    return String(entry);
  });
}

/** Last resort for a value with no shape of its own. */
function plain(value: unknown): string {
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function formatFieldValue(
  node: FieldNode,
  value: unknown,
  registry?: CustomComponentRegistry,
): ReactNode {
  const props = node.props ?? {};

  // Booleans are the one type whose "empty" reading is a real answer, and
  // `custom` components decide for themselves what an empty value means.
  const booleanish = node.type === 'checkbox' || node.type === 'switch';
  if (isBlank(value) && !booleanish && node.type !== 'custom') return blankText();

  switch (node.type) {
    case 'password':
      return MASK;

    case 'textarea':
      // Authored line breaks are content — a wrapped paragraph loses them.
      return <span style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</span>;

    case 'number':
    case 'slider': {
      const values = Array.isArray(value) ? value : [value];
      const text = values
        .map((entry) => {
          const numeric = Number(entry);
          if (!Number.isFinite(numeric)) return String(entry);
          return formatNumber(numeric, {
            precision: num(props, 'precision'),
            thousandSeparator: str(props, 'thousandSeparator'),
            decimalSeparator: str(props, 'decimalSeparator'),
          });
        })
        .join(' – ');
      const suffix = str(props, 'suffix') ?? str(props, 'unit') ?? '';
      return `${str(props, 'prefix') ?? ''}${text}${suffix}`;
    }

    case 'select':
    case 'autoComplete':
      if (Array.isArray(value)) return tagList(value, node.options);
      return labelFor(value, node.options);

    case 'radio':
    case 'segmented':
      return labelFor(value, node.options);

    case 'transfer':
      // The payload holds the keys that moved across, so the option list is
      // what turns them back into something readable.
      return tagList(Array.isArray(value) ? value : [value], node.options);

    case 'cascader':
    case 'treeSelect': {
      // A cascader's value is the path down the tree, so the labels along it
      // read better joined than as separate tags.
      const labels = treeLabels(value, node.treeOptions ?? []);
      if (labels.length === 0) return plain(value);
      return labels.join(node.type === 'cascader' ? ' / ' : ', ');
    }

    case 'checkboxGroup':
      return tagList(Array.isArray(value) ? value : [value], node.options);

    case 'checkbox':
    case 'switch': {
      if (value === undefined || value === null) return blankText();
      const checked = Boolean(value);
      const on = str(props, 'checkedChildren') ?? 'Yes';
      const off = str(props, 'unCheckedChildren') ?? 'No';
      return checked ? on : off;
    }

    case 'date':
      return dateText(node, value, defaultDateFormat(props));

    case 'time':
      return dateText(node, value, 'HH:mm:ss');

    case 'dateRange': {
      if (!Array.isArray(value)) return plain(value);
      const separator = str(props, 'separator') ?? '→';
      const fallback = defaultDateFormat(props);
      return value.map((entry) => dateText(node, entry, fallback)).join(` ${separator} `);
    }

    case 'timeRange': {
      if (!Array.isArray(value)) return plain(value);
      const separator = str(props, 'separator') ?? '→';
      return value.map((entry) => dateText(node, entry, 'HH:mm:ss')).join(` ${separator} `);
    }

    case 'otp':
      // A code is a code — never reformatted, and never masked here, because a
      // summary page exists so the reader can check what they entered.
      return plain(value);

    case 'colorPicker': {
      if (isBlank(value)) return blankText();
      const css = String(value);
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: css,
              border: '1px solid rgba(5, 5, 5, 0.15)',
            }}
          />
          {css}
        </span>
      );
    }

    case 'rate':
      return (
        <Rate
          disabled
          value={Number(value)}
          count={num(props, 'count') ?? 5}
          allowHalf={props.allowHalf === true}
          style={{ fontSize: 16 }}
        />
      );

    case 'upload': {
      const names = fileNames(value);
      if (names.length === 0) return blankText();
      return names.join(', ');
    }

    case 'custom': {
      if (isBlank(value)) return blankText();
      const def = customDefFor(node, registry);
      // A host that wants a swatch or a table renders one; otherwise fall back
      // to whatever the field puts in the payload. The blank case is handled
      // above so every field on the page reads the same when unanswered.
      if (def?.summary) return def.summary(value, node);
      return plain(def?.serialize ? def.serialize(value, node) : value);
    }

    default:
      return plain(value);
  }
}
