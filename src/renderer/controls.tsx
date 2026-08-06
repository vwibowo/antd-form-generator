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
import type { ReactElement } from 'react';
import type { FieldNode } from '@/schema/schema';

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
 * Map a node to its antd control. The control receives no `value`/`onChange` —
 * `Form.Item` injects those.
 */
export function renderControl(node: FieldNode): ReactElement | null {
  const props = node.props ?? {};
  const common = {
    disabled: node.disabled,
    placeholder: node.placeholder,
  };
  const options = node.options ?? [];

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
          disabled={node.disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          min={num(props, 'min')}
          max={num(props, 'max')}
          step={num(props, 'step', 1)}
          precision={num(props, 'precision')}
        />
      );

    case 'select':
      return (
        <Select
          {...common}
          allowClear
          showSearch={bool(props, 'showSearch')}
          mode={str(props, 'mode') as 'multiple' | 'tags' | undefined}
          options={options}
        />
      );

    case 'radio':
      return (
        <Radio.Group
          disabled={node.disabled}
          options={options}
          optionType={bool(props, 'button') ? 'button' : 'default'}
        />
      );

    case 'checkboxGroup':
      return <Checkbox.Group disabled={node.disabled} options={options} />;

    case 'checkbox':
      return <Checkbox disabled={node.disabled}>{str(props, 'text', node.label)}</Checkbox>;

    case 'switch':
      return <Switch disabled={node.disabled} />;

    case 'date':
      return (
        <DatePicker
          disabled={node.disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
          picker={str(props, 'picker', 'date') as 'date' | 'week' | 'month' | 'quarter' | 'year'}
          showTime={bool(props, 'showTime')}
        />
      );

    case 'dateRange':
      return <RangePicker disabled={node.disabled} style={{ width: '100%' }} />;

    case 'time':
      return (
        <TimePicker
          disabled={node.disabled}
          placeholder={node.placeholder}
          style={{ width: '100%' }}
        />
      );

    case 'slider':
      return (
        <Slider
          disabled={node.disabled}
          min={num(props, 'min', 0)}
          max={num(props, 'max', 100)}
          step={num(props, 'step', 1)}
        />
      );

    case 'rate':
      return <Rate disabled={node.disabled} count={num(props, 'count', 5)} allowHalf={bool(props, 'allowHalf')} />;

    case 'upload':
      return (
        // No backend in this app — keep files client-side.
        <Upload beforeUpload={() => false} multiple={bool(props, 'multiple')} maxCount={num(props, 'maxCount')}>
          <Button icon={<UploadOutlined />} disabled={node.disabled}>
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
