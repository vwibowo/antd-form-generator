import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import {
  AutoComplete,
  Button,
  Cascader,
  Checkbox,
  ColorPicker,
  DatePicker,
  Input,
  InputNumber,
  Mentions,
  Radio,
  Rate,
  Segmented,
  Select,
  Slider,
  Switch,
  TimePicker,
  Transfer,
  TreeSelect,
  Upload,
} from 'antd';
import type { ReactElement, ReactNode } from 'react';
import type { ScreenNode, SelectOption } from '@/schema/screen';
import type { CustomComponentRegistry } from './custom';
import { MissingCustomComponent, customDefFor, customKeyOf } from './custom';
import { parseDateValue } from './dateValue';
import { numberFormatters } from './numberFormat';

const { RangePicker } = DatePicker;
const TimeRangePicker = TimePicker.RangePicker;

type Props = Record<string, unknown>;

/** antd 6 input variants, shared by Input, InputNumber, Select and the pickers. */
type Variant = 'outlined' | 'filled' | 'borderless' | 'underlined';
type ControlSize = 'small' | 'middle' | 'large';

const VARIANTS: readonly string[] = ['outlined', 'filled', 'borderless', 'underlined'];
const SIZES: readonly string[] = ['small', 'middle', 'large'];

function num(props: Props, key: string, fallback?: number): number | undefined {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

function str(props: Props, key: string, fallback?: string): string | undefined {
  const value = props[key];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function bool(props: Props, key: string, fallback = false): boolean {
  const value = props[key];
  return typeof value === 'boolean' ? value : fallback;
}

// `addonBefore`/`addonAfter` are deliberately absent: antd 6 deprecates both.
const AFFIX_KEYS = ['prefix', 'suffix'] as const;

/**
 * `prefix`/`suffix` are ReactNode props, authored as text. Absent keys are left
 * out entirely so antd keeps its own defaults.
 */
function affix(props: Props, keys: readonly string[] = AFFIX_KEYS): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = str(props, key);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Per-field overrides of the form-wide look. */
function appearance(props: Props): { variant?: Variant; size?: ControlSize } {
  const variant = str(props, 'variant');
  const size = str(props, 'size');
  return {
    variant: variant && VARIANTS.includes(variant) ? (variant as Variant) : undefined,
    size: size && SIZES.includes(size) ? (size as ControlSize) : undefined,
  };
}

/**
 * Select and the pickers have no `readOnly` prop — the value has to be kept
 * reachable (unlike `disabled`, it still submits) while every way of changing it
 * is closed off: no popup, no typing, no clear button.
 */
function readOnlyPickerProps(props: Props): Record<string, unknown> {
  if (!bool(props, 'readOnly')) return {};
  return { open: false, inputReadOnly: true, allowClear: false };
}

function readOnlySelectProps(props: Props): Record<string, unknown> {
  if (!bool(props, 'readOnly')) return {};
  return { open: false, allowClear: false, showSearch: false };
}

/** `responsive` or a count; anything else means no limit. */
/**
 * `Input.OTP`'s mask takes a boolean or the single character to show.
 * A one-character string means "mask with this"; anything else is a plain flag.
 */
function otpMask(props: Props): boolean | string | undefined {
  const raw = props.mask;
  if (typeof raw === 'string' && raw.length === 1) return raw;
  return typeof raw === 'boolean' ? raw : undefined;
}

/** Cascader search matches on any label along the path, not just the leaf. */
function cascaderFilter(input: string, path: { label?: ReactNode }[]): boolean {
  const term = input.toLowerCase();
  return path.some(
    (step) => typeof step.label === 'string' && step.label.toLowerCase().includes(term),
  );
}

function maxTagCount(props: Props): number | 'responsive' | undefined {
  const raw = props.maxTagCount;
  if (raw === 'responsive') return 'responsive';
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** `minDate`/`maxDate` are authored as text; the picker wants dayjs. */
function dateBound(props: Props, key: string) {
  return parseDateValue(str(props, key));
}

/**
 * Anything the caller had to resolve asynchronously. Keeping these as an
 * argument is what lets `renderControl` stay a pure function: the builder
 * canvas calls it with no overrides and therefore cannot fire a request.
 */
export interface ControlOverrides {
  /** Replaces `node.options` when options come from a remote source. */
  options?: SelectOption[];
  loading?: boolean;
  /** Present only in server-search mode; wires antd `onSearch`. */
  onSearch?: (term: string) => void;
  /** Disables on top of `node.disabled` — e.g. a dependency is still blank. */
  disabled?: boolean;
  notFoundContent?: ReactNode;
}

/**
 * Map a node to its antd control. The control receives no `value`/`onChange` —
 * `Form.Item` injects those.
 *
 * Every key read out of `node.props` here has a matching entry in
 * `src/schema/propSpecs.ts`, which is what the inspector renders.
 */
export function renderControl(
  node: ScreenNode,
  overrides?: ControlOverrides,
  /** Host-supplied controls. Only consulted for `custom` nodes. */
  registry?: CustomComponentRegistry,
): ReactElement | null {
  const props = node.props ?? {};
  const disabled = node.disabled || overrides?.disabled === true;
  const common = {
    disabled,
    placeholder: node.placeholder,
  };
  const options = overrides?.options ?? node.options ?? [];
  const treeOptions = node.treeOptions ?? [];
  const readOnly = bool(props, 'readOnly');

  switch (node.type) {
    case 'input':
      return (
        <Input
          {...common}
          {...affix(props)}
          {...appearance(props)}
          type={str(props, 'inputType')}
          readOnly={readOnly}
          allowClear={bool(props, 'allowClear', true) && !readOnly}
          maxLength={num(props, 'maxLength')}
        />
      );

    case 'textarea':
      return (
        <Input.TextArea
          {...common}
          {...appearance(props)}
          rows={num(props, 'rows', 4)}
          autoSize={
            bool(props, 'autoSize')
              ? { minRows: num(props, 'minRows'), maxRows: num(props, 'maxRows') }
              : undefined
          }
          readOnly={readOnly}
          allowClear={bool(props, 'allowClear') && !readOnly}
          maxLength={num(props, 'maxLength')}
          showCount={bool(props, 'showCount')}
        />
      );

    case 'password':
      return (
        <Input.Password
          {...common}
          // `suffix` is the reveal icon's slot, so it is not offered here.
          {...affix(props, ['prefix'])}
          {...appearance(props)}
          readOnly={readOnly}
          visibilityToggle={bool(props, 'visibilityToggle', true)}
          maxLength={num(props, 'maxLength')}
        />
      );

    case 'number': {
      const { formatter, parser } = numberFormatters(props);
      return (
        <InputNumber
          disabled={disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          {...affix(props)}
          {...appearance(props)}
          min={num(props, 'min')}
          max={num(props, 'max')}
          step={num(props, 'step', 1)}
          precision={num(props, 'precision')}
          controls={bool(props, 'controls', true)}
          keyboard={bool(props, 'keyboard', true)}
          stringMode={bool(props, 'stringMode')}
          readOnly={readOnly}
          formatter={formatter}
          parser={parser}
        />
      );
    }

    case 'otp':
      return (
        <Input.OTP
          disabled={disabled}
          length={num(props, 'length', 6)}
          mask={otpMask(props)}
          {...appearance(props)}
          formatter={bool(props, 'upperCase') ? (text) => text.toUpperCase() : undefined}
        />
      );

    case 'autoComplete':
      return (
        <AutoComplete
          {...common}
          {...appearance(props)}
          options={options}
          allowClear={bool(props, 'allowClear', true)}
          backfill={bool(props, 'backfill')}
          // In server-search mode the list already IS the result, so antd must
          // not filter it again — the same rule `select` follows.
          filterOption={overrides?.onSearch !== undefined ? false : bool(props, 'filterOption', true)}
          onSearch={overrides?.onSearch}
        />
      );

    case 'mentions':
      return (
        <Mentions
          {...common}
          {...appearance(props)}
          rows={num(props, 'rows', 3)}
          prefix={str(props, 'prefix', '@')}
          split={str(props, 'split')}
          options={options.map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
        />
      );

    case 'segmented':
      return (
        <Segmented
          disabled={disabled}
          block={bool(props, 'block', true)}
          // `Segmented` takes a size but no variant, so `appearance` cannot be
          // spread here without passing antd an unknown prop.
          size={appearance(props).size}
          vertical={bool(props, 'vertical')}
          options={options.map((option) => ({ label: option.label, value: option.value }))}
        />
      );

    case 'cascader':
      return (
        <Cascader
          {...common}
          {...appearance(props)}
          style={{ width: '100%' }}
          options={treeOptions}
          expandTrigger={bool(props, 'expandOnHover') ? 'hover' : 'click'}
          changeOnSelect={bool(props, 'changeOnSelect')}
          multiple={bool(props, 'multiple') || undefined}
          showSearch={bool(props, 'showSearch') ? { filter: cascaderFilter } : undefined}
          allowClear={bool(props, 'allowClear', true)}
        />
      );

    case 'treeSelect':
      return (
        <TreeSelect
          {...common}
          {...appearance(props)}
          style={{ width: '100%' }}
          treeData={treeOptions}
          treeCheckable={bool(props, 'checkable')}
          multiple={bool(props, 'multiple')}
          showSearch={bool(props, 'showSearch', true)}
          treeDefaultExpandAll={bool(props, 'expandAll')}
          allowClear={bool(props, 'allowClear', true)}
          treeNodeFilterProp="label"
        />
      );

    case 'transfer':
      return (
        <Transfer
          disabled={disabled}
          // `Transfer` wants a keyed list, and an option's value is its key.
          dataSource={options.map((option) => ({
            key: String(option.value),
            title: option.label,
          }))}
          render={(item) => item.title ?? item.key}
          titles={[str(props, 'leftTitle', 'Available'), str(props, 'rightTitle', 'Chosen')]}
          showSearch={bool(props, 'showSearch')}
          oneWay={bool(props, 'oneWay')}
          // `styles.section`, not `listStyle`: antd 6 deprecates the latter.
          styles={{
            section: {
              width: num(props, 'paneWidth', 220),
              height: num(props, 'paneHeight', 220),
            },
          }}
        />
      );

    case 'select': {
      // In server-search mode the list already IS the search result, so antd
      // must not filter it again — and must show a spinner rather than "No data".
      const serverSearch = overrides?.onSearch !== undefined;
      return (
        <Select
          {...common}
          {...affix(props, ['prefix'])}
          {...appearance(props)}
          allowClear={bool(props, 'allowClear', true)}
          showSearch={serverSearch || bool(props, 'showSearch')}
          filterOption={serverSearch ? false : undefined}
          onSearch={overrides?.onSearch}
          loading={overrides?.loading}
          notFoundContent={overrides?.notFoundContent}
          mode={str(props, 'mode') as 'multiple' | 'tags' | undefined}
          maxTagCount={maxTagCount(props)}
          maxCount={num(props, 'maxCount')}
          placement={
            str(props, 'placement') as
              | 'bottomLeft'
              | 'bottomRight'
              | 'topLeft'
              | 'topRight'
              | undefined
          }
          options={options}
          {...readOnlySelectProps(props)}
        />
      );
    }

    case 'radio':
      return (
        <Radio.Group
          disabled={disabled}
          options={options}
          optionType={bool(props, 'button') ? 'button' : 'default'}
          buttonStyle={str(props, 'buttonStyle') as 'outline' | 'solid' | undefined}
          size={appearance(props).size}
          block={bool(props, 'block')}
        />
      );

    case 'checkboxGroup':
      return <Checkbox.Group disabled={disabled} options={options} />;

    case 'checkbox':
      return <Checkbox disabled={disabled}>{str(props, 'text', node.label)}</Checkbox>;

    case 'switch':
      return (
        <Switch
          disabled={disabled}
          checkedChildren={str(props, 'checkedChildren')}
          unCheckedChildren={str(props, 'unCheckedChildren')}
          size={str(props, 'size') === 'small' ? 'small' : undefined}
        />
      );

    case 'date':
      return (
        <DatePicker
          disabled={disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          {...affix(props, ['prefix'])}
          {...appearance(props)}
          picker={str(props, 'picker', 'date') as 'date' | 'week' | 'month' | 'quarter' | 'year'}
          showTime={bool(props, 'showTime')}
          format={str(props, 'format')}
          minDate={dateBound(props, 'minDate')}
          maxDate={dateBound(props, 'maxDate')}
          allowClear={bool(props, 'allowClear', true)}
          inputReadOnly={bool(props, 'inputReadOnly')}
          {...readOnlyPickerProps(props)}
        />
      );

    case 'dateRange': {
      const start = str(props, 'startPlaceholder');
      const end = str(props, 'endPlaceholder');
      return (
        <RangePicker
          disabled={disabled}
          style={{ width: '100%' }}
          placeholder={start || end ? [start ?? '', end ?? ''] : undefined}
          separator={str(props, 'separator')}
          {...affix(props, ['prefix'])}
          {...appearance(props)}
          picker={str(props, 'picker', 'date') as 'date' | 'week' | 'month' | 'quarter' | 'year'}
          showTime={bool(props, 'showTime')}
          format={str(props, 'format')}
          order={bool(props, 'order', true)}
          minDate={dateBound(props, 'minDate')}
          maxDate={dateBound(props, 'maxDate')}
          allowClear={bool(props, 'allowClear', true)}
          inputReadOnly={bool(props, 'inputReadOnly')}
          {...readOnlyPickerProps(props)}
        />
      );
    }

    case 'time':
      return (
        <TimePicker
          disabled={disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          {...appearance(props)}
          format={str(props, 'format')}
          use12Hours={bool(props, 'use12Hours')}
          hourStep={num(props, 'hourStep') as 1 | undefined}
          minuteStep={num(props, 'minuteStep') as 1 | undefined}
          secondStep={num(props, 'secondStep') as 1 | undefined}
          allowClear={bool(props, 'allowClear', true)}
          inputReadOnly={bool(props, 'inputReadOnly')}
          {...readOnlyPickerProps(props)}
        />
      );

    case 'timeRange': {
      const start = str(props, 'startPlaceholder');
      const end = str(props, 'endPlaceholder');
      return (
        <TimeRangePicker
          disabled={disabled}
          style={{ width: '100%' }}
          placeholder={start || end ? [start ?? '', end ?? ''] : undefined}
          {...appearance(props)}
          format={str(props, 'format')}
          use12Hours={bool(props, 'use12Hours')}
          hourStep={num(props, 'hourStep') as 1 | undefined}
          minuteStep={num(props, 'minuteStep') as 1 | undefined}
          secondStep={num(props, 'secondStep') as 1 | undefined}
          order={bool(props, 'order', true)}
          allowClear={bool(props, 'allowClear', true)}
          inputReadOnly={bool(props, 'inputReadOnly')}
          {...readOnlyPickerProps(props)}
        />
      );
    }

    case 'colorPicker':
      return (
        <ColorPicker
          disabled={disabled}
          showText={bool(props, 'showText', true)}
          allowClear={bool(props, 'allowClear')}
          format={str(props, 'format') as 'rgb' | 'hex' | 'hsb' | undefined}
          size={appearance(props).size}
          // The value leaves antd as a `Color` object; `serializeValues` turns it
          // into a hex string on the way out and `hydrateValues` reads it back.
          disabledAlpha={bool(props, 'disabledAlpha')}
        />
      );

    case 'slider': {
      const unit = str(props, 'unit');
      return (
        <Slider
          disabled={disabled}
          min={num(props, 'min', 0)}
          max={num(props, 'max', 100)}
          step={num(props, 'step', 1)}
          dots={bool(props, 'dots')}
          reverse={bool(props, 'reverse')}
          vertical={bool(props, 'vertical')}
          tooltip={unit ? { formatter: (value) => `${value ?? ''}${unit}` } : undefined}
        />
      );
    }

    case 'rate':
      return (
        <Rate
          disabled={disabled}
          count={num(props, 'count', 5)}
          allowHalf={bool(props, 'allowHalf')}
          allowClear={bool(props, 'allowClear', true)}
          character={str(props, 'character')}
        />
      );

    case 'upload': {
      const shared = {
        // No backend in this app — keep files client-side.
        beforeUpload: () => false,
        multiple: bool(props, 'multiple'),
        maxCount: num(props, 'maxCount'),
        accept: str(props, 'accept'),
        listType: str(props, 'listType') as
          | 'picture'
          | 'picture-card'
          | 'picture-circle'
          | undefined,
        showUploadList: bool(props, 'showUploadList', true),
      };

      // A dragger is the same Upload with its own layout, so it shares every
      // prop and only differs in what it renders inside.
      if (bool(props, 'drag')) {
        return (
          <Upload.Dragger {...shared} disabled={disabled}>
            <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {str(props, 'dragText', 'Click or drag a file here to upload')}
            </p>
            {str(props, 'dragHint') ? (
              <p className="ant-upload-hint">{str(props, 'dragHint')}</p>
            ) : null}
          </Upload.Dragger>
        );
      }

      return (
        <Upload {...shared}>
          <Button
            icon={<UploadOutlined />}
            disabled={disabled}
            // A picture-card list expects a compact tile, not a labelled button.
            type={shared.listType === 'picture-card' ? 'text' : 'default'}
          >
            {str(props, 'buttonText', 'Select file')}
          </Button>
        </Upload>
      );
    }

    case 'custom': {
      const def = customDefFor(node, registry);
      if (!def) return <MissingCustomComponent componentKey={customKeyOf(node)} />;
      const Component = def.component;
      // `value` and `onChange` are not passed here — `Form.Item` clones this
      // element and injects them, exactly as it does for the antd controls.
      return (
        <Component
          node={node}
          disabled={disabled}
          placeholder={node.placeholder}
          options={options}
        />
      );
    }

    default:
      return null;
  }
}

/**
 * antd 6 renamed the Card size `default` to `medium` and warns on the old
 * name. Schemas saved before that rename still carry `default`, so normalise
 * on read rather than migrating the stored JSON.
 */
export function cardSize(props: Props | undefined): 'medium' | 'small' {
  return props?.size === 'small' ? 'small' : 'medium';
}

export function cardVariant(props: Props | undefined): 'outlined' | 'borderless' {
  return props?.variant === 'borderless' ? 'borderless' : 'outlined';
}

/**
 * A card set to collapse is drawn as a one-panel `Collapse` rather than a
 * `Card` — that is where the Collapse component lives, reached through the
 * container that already had the drop target and the nesting rules.
 *
 * Collapsing hides; it never unmounts. `Form.Item` carries `preserve={false}`,
 * so a folded section that unmounted would quietly drop its values from the
 * payload.
 */
export function cardCollapsible(props: Props | undefined): boolean {
  return props?.collapsible === true;
}

/** Panel keys an antd `Collapse` should open with. Empty means folded shut. */
export function cardDefaultOpenKeys(props: Props | undefined): string[] {
  return props?.defaultOpen === false ? [] : ['panel'];
}

/**
 * `divider` and `title` render no control, so they never reach `renderControl` —
 * both the renderer and the builder canvas draw them directly. Their props are
 * resolved here so the two stay identical.
 */
export function dividerProps(props: Props | undefined, hasLabel: boolean) {
  const bag = props ?? {};
  return {
    titlePlacement: str(bag, 'titlePlacement', 'start') as 'start' | 'center' | 'end',
    variant: str(bag, 'variant') as 'dashed' | 'dotted' | undefined,
    size: str(bag, 'size') as ControlSize | undefined,
    plain: bool(bag, 'plain', !hasLabel),
  };
}

export function titleProps(props: Props | undefined) {
  const bag = props ?? {};
  return {
    level: (num(bag, 'level', 4) ?? 4) as 1 | 2 | 3 | 4 | 5,
    type: str(bag, 'type') as 'secondary' | 'success' | 'warning' | 'danger' | undefined,
    italic: bool(bag, 'italic'),
    underline: bool(bag, 'underline'),
  };
}

/** Controls whose value lives on `checked` rather than `value`. */
export function valuePropNameFor(
  node: ScreenNode,
  registry?: CustomComponentRegistry,
): string | undefined {
  if (node.type === 'checkbox' || node.type === 'switch') return 'checked';
  if (node.type === 'upload') return 'fileList';
  // `Transfer` reports the keys that have moved across as `targetKeys`.
  if (node.type === 'transfer') return 'targetKeys';
  if (node.type === 'custom') return customDefFor(node, registry)?.valuePropName;
  return undefined;
}

/** Upload hands `Form.Item` an event object; unwrap it to the file list. */
export function getValueFromEventFor(node: ScreenNode) {
  if (node.type !== 'upload') return undefined;
  return (event: unknown): unknown => {
    if (Array.isArray(event)) return event;
    if (event && typeof event === 'object' && 'fileList' in event) {
      return (event as { fileList: unknown }).fileList;
    }
    return event;
  };
}
