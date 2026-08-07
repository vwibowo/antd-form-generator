import { UploadOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  Rate,
  Select,
  Slider,
  Switch,
  TimePicker,
  Upload,
} from 'antd';
import type { ReactElement, ReactNode } from 'react';
import type { FieldNode, SelectOption } from '@/schema/schema';

const { RangePicker } = DatePicker;

type Props = Record<string, unknown>;

function num(props: Props, key: string, fallback?: number): number | undefined {
  const value = props[key];
  return typeof value === 'number' ? value : fallback;
}

function str(props: Props, key: string, fallback?: string): string | undefined {
  const value = props[key];
  return typeof value === 'string' ? value : fallback;
}

function bool(props: Props, key: string, fallback = false): boolean {
  const value = props[key];
  return typeof value === 'boolean' ? value : fallback;
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
 */
export function renderControl(
  node: FieldNode,
  overrides?: ControlOverrides,
): ReactElement | null {
  const props = node.props ?? {};
  const disabled = node.disabled || overrides?.disabled === true;
  const common = {
    disabled,
    placeholder: node.placeholder,
  };
  const options = overrides?.options ?? node.options ?? [];

  switch (node.type) {
    case 'input':
      return <Input {...common} allowClear maxLength={num(props, 'maxLength')} />;

    case 'textarea':
      return (
        <Input.TextArea
          {...common}
          rows={num(props, 'rows', 4)}
          maxLength={num(props, 'maxLength')}
          showCount={bool(props, 'showCount')}
        />
      );

    case 'password':
      return <Input.Password {...common} />;

    case 'number':
      return (
        <InputNumber
          disabled={disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          min={num(props, 'min')}
          max={num(props, 'max')}
          step={num(props, 'step', 1)}
          precision={num(props, 'precision')}
        />
      );

    case 'select': {
      // In server-search mode the list already IS the search result, so antd
      // must not filter it again — and must show a spinner rather than "No data".
      const serverSearch = overrides?.onSearch !== undefined;
      return (
        <Select
          {...common}
          allowClear
          showSearch={serverSearch || bool(props, 'showSearch')}
          filterOption={serverSearch ? false : undefined}
          onSearch={overrides?.onSearch}
          loading={overrides?.loading}
          notFoundContent={overrides?.notFoundContent}
          mode={str(props, 'mode') as 'multiple' | 'tags' | undefined}
          options={options}
        />
      );
    }

    case 'radio':
      return (
        <Radio.Group
          disabled={disabled}
          options={options}
          optionType={bool(props, 'button') ? 'button' : 'default'}
        />
      );

    case 'checkboxGroup':
      return <Checkbox.Group disabled={disabled} options={options} />;

    case 'checkbox':
      return <Checkbox disabled={disabled}>{str(props, 'text', node.label)}</Checkbox>;

    case 'switch':
      return <Switch disabled={disabled} />;

    case 'date':
      return (
        <DatePicker
          disabled={disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          picker={str(props, 'picker', 'date') as 'date' | 'week' | 'month' | 'quarter' | 'year'}
          showTime={bool(props, 'showTime')}
        />
      );

    case 'dateRange':
      return <RangePicker disabled={disabled} style={{ width: '100%' }} />;

    case 'time':
      return (
        <TimePicker
          disabled={disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
        />
      );

    case 'slider':
      return (
        <Slider
          disabled={disabled}
          min={num(props, 'min', 0)}
          max={num(props, 'max', 100)}
          step={num(props, 'step', 1)}
        />
      );

    case 'rate':
      return <Rate disabled={disabled} count={num(props, 'count', 5)} allowHalf={bool(props, 'allowHalf')} />;

    case 'upload':
      return (
        // No backend in this app — keep files client-side.
        <Upload beforeUpload={() => false} multiple={bool(props, 'multiple')} maxCount={num(props, 'maxCount')}>
          <Button icon={<UploadOutlined />} disabled={disabled}>
            {str(props, 'buttonText', 'Select file')}
          </Button>
        </Upload>
      );

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

/** Controls whose value lives on `checked` rather than `value`. */
export function valuePropNameFor(node: FieldNode): string | undefined {
  if (node.type === 'checkbox' || node.type === 'switch') return 'checked';
  if (node.type === 'upload') return 'fileList';
  return undefined;
}

/** Upload hands `Form.Item` an event object; unwrap it to the file list. */
export function getValueFromEventFor(node: FieldNode) {
  if (node.type !== 'upload') return undefined;
  return (event: unknown): unknown => {
    if (Array.isArray(event)) return event;
    if (event && typeof event === 'object' && 'fileList' in event) {
      return (event as { fileList: unknown }).fileList;
    }
    return event;
  };
}
