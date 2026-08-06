import { Checkbox, Input, InputNumber, Select } from 'antd';
import type { FieldNode } from '@/schema/schema';
import { Labeled } from './Labeled';

export interface TypePropsProps {
  node: FieldNode;
  onPatch: (patch: Partial<FieldNode>) => void;
}

/** Types with a non-empty settings section — keeps the inspector free of blanks. */
const TYPES_WITH_PROPS = new Set([
  'input',
  'password',
  'textarea',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
  'slider',
  'rate',
  'upload',
  'title',
  'card',
  'list',
]);

export function hasTypeProps(type: FieldNode['type']): boolean {
  return TYPES_WITH_PROPS.has(type);
}

/** Per-type antd control options, stored in the node's free-form `props` bag. */
export function TypeProps({ node, onPatch }: TypePropsProps) {
  const props = node.props ?? {};
  const setProp = (key: string, value: unknown) => {
    const next = { ...props };
    if (value === undefined || value === '') {
      delete next[key];
    } else {
      next[key] = value;
    }
    onPatch({ props: next });
  };

  const numberProp = (key: string) => (typeof props[key] === 'number' ? (props[key] as number) : undefined);
  const stringProp = (key: string) => (typeof props[key] === 'string' ? (props[key] as string) : undefined);
  const boolProp = (key: string) => props[key] === true;

  switch (node.type) {
    case 'input':
    case 'password':
      return (
        <Labeled label="Max length">
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            min={1}
            value={numberProp('maxLength')}
            onChange={(value) => setProp('maxLength', value ?? undefined)}
          />
        </Labeled>
      );

    case 'textarea':
      return (
        <>
          <Labeled label="Rows">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={1}
              value={numberProp('rows') ?? 4}
              onChange={(value) => setProp('rows', value ?? 4)}
            />
          </Labeled>
          <Labeled label="Max length">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={1}
              value={numberProp('maxLength')}
              onChange={(value) => setProp('maxLength', value ?? undefined)}
            />
          </Labeled>
          <Checkbox
            checked={boolProp('showCount')}
            onChange={(event) => setProp('showCount', event.target.checked || undefined)}
          >
            Show character count
          </Checkbox>
        </>
      );

    case 'number':
      return (
        <>
          <Labeled label="Minimum">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={numberProp('min')}
              onChange={(value) => setProp('min', value ?? undefined)}
            />
          </Labeled>
          <Labeled label="Maximum">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={numberProp('max')}
              onChange={(value) => setProp('max', value ?? undefined)}
            />
          </Labeled>
          <Labeled label="Step">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={numberProp('step') ?? 1}
              onChange={(value) => setProp('step', value ?? 1)}
            />
          </Labeled>
          <Labeled label="Decimal places">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={0}
              value={numberProp('precision')}
              onChange={(value) => setProp('precision', value ?? undefined)}
            />
          </Labeled>
        </>
      );

    case 'select':
      return (
        <>
          <Labeled label="Selection mode">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={stringProp('mode') ?? 'single'}
              options={[
                { label: 'Single', value: 'single' },
                { label: 'Multiple', value: 'multiple' },
                { label: 'Tags (free text)', value: 'tags' },
              ]}
              onChange={(value) => setProp('mode', value === 'single' ? undefined : value)}
            />
          </Labeled>
          <Checkbox
            checked={boolProp('showSearch')}
            onChange={(event) => setProp('showSearch', event.target.checked || undefined)}
          >
            Searchable
          </Checkbox>
        </>
      );

    case 'radio':
      return (
        <Checkbox
          checked={boolProp('button')}
          onChange={(event) => setProp('button', event.target.checked || undefined)}
        >
          Render as button group
        </Checkbox>
      );

    case 'checkbox':
      return (
        <Labeled label="Checkbox text">
          <Input
            size="small"
            value={stringProp('text') ?? ''}
            onChange={(event) => setProp('text', event.target.value || undefined)}
          />
        </Labeled>
      );

    case 'date':
      return (
        <>
          <Labeled label="Granularity">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={stringProp('picker') ?? 'date'}
              options={[
                { label: 'Date', value: 'date' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Quarter', value: 'quarter' },
                { label: 'Year', value: 'year' },
              ]}
              onChange={(value) => setProp('picker', value)}
            />
          </Labeled>
          <Checkbox
            checked={boolProp('showTime')}
            onChange={(event) => setProp('showTime', event.target.checked || undefined)}
          >
            Include time
          </Checkbox>
        </>
      );

    case 'slider':
      return (
        <>
          <Labeled label="Minimum">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={numberProp('min') ?? 0}
              onChange={(value) => setProp('min', value ?? 0)}
            />
          </Labeled>
          <Labeled label="Maximum">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              value={numberProp('max') ?? 100}
              onChange={(value) => setProp('max', value ?? 100)}
            />
          </Labeled>
          <Labeled label="Step">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={1}
              value={numberProp('step') ?? 1}
              onChange={(value) => setProp('step', value ?? 1)}
            />
          </Labeled>
        </>
      );

    case 'rate':
      return (
        <>
          <Labeled label="Star count">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={1}
              max={10}
              value={numberProp('count') ?? 5}
              onChange={(value) => setProp('count', value ?? 5)}
            />
          </Labeled>
          <Checkbox
            checked={boolProp('allowHalf')}
            onChange={(event) => setProp('allowHalf', event.target.checked || undefined)}
          >
            Allow half stars
          </Checkbox>
        </>
      );

    case 'upload':
      return (
        <>
          <Labeled label="Button text">
            <Input
              size="small"
              value={stringProp('buttonText') ?? ''}
              onChange={(event) => setProp('buttonText', event.target.value || undefined)}
            />
          </Labeled>
          <Labeled label="Max files">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={1}
              value={numberProp('maxCount')}
              onChange={(value) => setProp('maxCount', value ?? undefined)}
            />
          </Labeled>
          <Checkbox
            checked={boolProp('multiple')}
            onChange={(event) => setProp('multiple', event.target.checked || undefined)}
          >
            Allow multiple files
          </Checkbox>
        </>
      );

    case 'title':
      return (
        <Labeled label="Heading level">
          <Select
            size="small"
            style={{ width: '100%' }}
            value={numberProp('level') ?? 4}
            options={[1, 2, 3, 4, 5].map((level) => ({ label: `H${level}`, value: level }))}
            onChange={(value) => setProp('level', value)}
          />
        </Labeled>
      );

    case 'card':
      return (
        <>
          <Labeled label="Card size">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={stringProp('size') === 'small' ? 'small' : 'medium'}
              options={[
                { label: 'Medium', value: 'medium' },
                { label: 'Small', value: 'small' },
              ]}
              onChange={(value) => setProp('size', value)}
            />
          </Labeled>
          <Labeled label="Border">
            <Select
              size="small"
              style={{ width: '100%' }}
              value={stringProp('variant') ?? 'outlined'}
              options={[
                { label: 'Outlined', value: 'outlined' },
                { label: 'Borderless', value: 'borderless' },
              ]}
              onChange={(value) => setProp('variant', value)}
            />
          </Labeled>
        </>
      );

    case 'list':
      return (
        <>
          <Labeled label="Add button text">
            <Input
              size="small"
              value={node.listConfig?.addText ?? 'Add item'}
              onChange={(event) =>
                onPatch({
                  listConfig: {
                    ...(node.listConfig ?? { addText: 'Add item' }),
                    addText: event.target.value,
                  },
                })
              }
            />
          </Labeled>
          <Labeled label="Minimum rows" help="Rows created automatically and not removable.">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={0}
              value={node.listConfig?.minItems}
              onChange={(value) =>
                onPatch({
                  listConfig: {
                    ...(node.listConfig ?? { addText: 'Add item' }),
                    minItems: value ?? undefined,
                  },
                })
              }
            />
          </Labeled>
          <Labeled label="Maximum rows">
            <InputNumber
              size="small"
              style={{ width: '100%' }}
              min={1}
              value={node.listConfig?.maxItems}
              onChange={(value) =>
                onPatch({
                  listConfig: {
                    ...(node.listConfig ?? { addText: 'Add item' }),
                    maxItems: value ?? undefined,
                  },
                })
              }
            />
          </Labeled>
        </>
      );

    default:
      return null;
  }
}
