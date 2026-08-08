import type { FieldNode, FieldType } from './schema';

/**
 * Declarative description of every per-type antd prop the inspector can edit.
 *
 * Builder-only metadata, like `registry.ts` — the renderer never reads this. It
 * switches on `type` and pulls keys out of `node.props` directly, so the two
 * stay in sync by convention: a spec entry here needs a matching read in
 * `src/renderer/controls.tsx` (or `FieldRenderer.tsx` for the structural types).
 *
 * Only props whose value is a string, number, boolean, enum, or a ReactNode that
 * reads well as text belong here. Function props (`disabledDate`, `optionRender`)
 * and object props (`style`, `marks`) have no JSON representation and are out.
 */

export interface PropOption {
  label: string;
  value: string | number;
}

export type PropEditor =
  | { kind: 'text'; placeholder?: string }
  | { kind: 'number'; min?: number; max?: number; step?: number }
  | { kind: 'bool' }
  | { kind: 'select'; options: PropOption[] }
  /** Presets in a dropdown, but anything can be typed — date formats, mostly. */
  | { kind: 'combo'; options: PropOption[]; placeholder?: string };

export type PropGroup = 'Appearance' | 'Behavior' | 'Format';

/** Render order of the subheadings in the settings panel. */
export const PROP_GROUPS: PropGroup[] = ['Appearance', 'Behavior', 'Format'];

export interface PropSpec {
  /** Key inside `node.props`. */
  key: string;
  label: string;
  editor: PropEditor;
  group: PropGroup;
  help?: string;
  /**
   * What the control shows while the key is absent. Setting a value equal to
   * this deletes the key again, so props only carry deliberate deviations.
   */
  default?: string | number | boolean;
  /** Hide the row entirely — e.g. row-count props while autoSize is off. */
  when?: (node: FieldNode) => boolean;
  /** Returns a tooltip when the value is forced; the row renders read-only. */
  lockedWhen?: (node: FieldNode) => string | undefined;
}

/* -------------------------------------------------------------------------- */
/* Shared fragments                                                            */
/* -------------------------------------------------------------------------- */

const SIZE_OPTIONS: PropOption[] = [
  { label: 'Inherit form size', value: '' },
  { label: 'Small', value: 'small' },
  { label: 'Middle', value: 'middle' },
  { label: 'Large', value: 'large' },
];

const VARIANT_OPTIONS: PropOption[] = [
  { label: 'Outlined (default)', value: '' },
  { label: 'Filled', value: 'filled' },
  { label: 'Borderless', value: 'borderless' },
  { label: 'Underlined', value: 'underlined' },
];

const variantSpec: PropSpec = {
  key: 'variant',
  label: 'Style',
  group: 'Appearance',
  editor: { kind: 'select', options: VARIANT_OPTIONS },
  default: '',
};

const sizeSpec: PropSpec = {
  key: 'size',
  label: 'Size',
  group: 'Appearance',
  editor: { kind: 'select', options: SIZE_OPTIONS },
  default: '',
  help: 'Overrides the form-level size for this field only.',
};

const allowClearSpec: PropSpec = {
  key: 'allowClear',
  label: 'Show clear button',
  group: 'Behavior',
  editor: { kind: 'bool' },
  default: true,
};

const allowClearOffSpec: PropSpec = { ...allowClearSpec, default: false };

const readOnlySpec: PropSpec = {
  key: 'readOnly',
  label: 'Read-only',
  group: 'Behavior',
  editor: { kind: 'bool' },
  default: false,
  help: 'Value is shown and submitted, but cannot be edited.',
};

const prefixSpec: PropSpec = {
  key: 'prefix',
  label: 'Prefix',
  group: 'Appearance',
  editor: { kind: 'text', placeholder: 'e.g. $' },
  help: 'Rendered inside the control, before the value.',
};

const suffixSpec: PropSpec = {
  key: 'suffix',
  label: 'Suffix',
  group: 'Appearance',
  editor: { kind: 'text', placeholder: 'e.g. kg' },
  help: 'Rendered inside the control, after the value.',
};

// No `addonBefore`/`addonAfter`: antd 6 deprecates both in favour of
// `Space.Compact`, which cannot wrap a control that `Form.Item` clones. Prefix
// and suffix cover the same ground without the deprecation warning.

const maxLengthSpec: PropSpec = {
  key: 'maxLength',
  label: 'Max length',
  group: 'Behavior',
  editor: { kind: 'number', min: 1 },
};

/* -------------------------------------------------------------------------- */
/* Date & time fragments                                                       */
/* -------------------------------------------------------------------------- */

const DATE_FORMAT_PRESETS: PropOption[] = [
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'D MMM YYYY', value: 'D MMM YYYY' },
  { label: 'DD/MM/YYYY HH:mm', value: 'DD/MM/YYYY HH:mm' },
  { label: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
];

const TIME_FORMAT_PRESETS: PropOption[] = [
  { label: 'HH:mm:ss', value: 'HH:mm:ss' },
  { label: 'HH:mm', value: 'HH:mm' },
  { label: 'hh:mm A', value: 'hh:mm A' },
];

/** Keywords understood by `serializeDateValue`; anything else is a dayjs pattern. */
const VALUE_FORMAT_PRESETS: PropOption[] = [
  { label: 'ISO 8601 (default)', value: '' },
  { label: 'Unix timestamp (ms)', value: 'timestamp' },
  { label: 'Unix timestamp (seconds)', value: 'unix' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
  { label: 'HH:mm:ss', value: 'HH:mm:ss' },
];

function displayFormatSpec(presets: PropOption[]): PropSpec {
  return {
    key: 'format',
    label: 'Display format',
    group: 'Format',
    editor: { kind: 'combo', options: presets, placeholder: 'antd default' },
    help: 'How the value is shown in the input. Any dayjs pattern works.',
  };
}

const valueFormatSpec: PropSpec = {
  key: 'valueFormat',
  label: 'Saved data format',
  group: 'Format',
  editor: { kind: 'combo', options: VALUE_FORMAT_PRESETS, placeholder: 'ISO 8601' },
  default: '',
  help: 'What lands in the submitted JSON. Also how a default value is read back.',
};

const pickerAppearance: PropSpec[] = [variantSpec, sizeSpec, allowClearSpec];

const pickerBehaviour: PropSpec[] = [
  readOnlySpec,
  {
    key: 'inputReadOnly',
    label: 'Block typing (calendar only)',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
  },
];

const dateBoundSpecs: PropSpec[] = [
  {
    key: 'minDate',
    label: 'Earliest allowed',
    group: 'Behavior',
    editor: { kind: 'text', placeholder: 'e.g. 2020-01-01' },
    help: 'ISO date or any dayjs-parseable string.',
  },
  {
    key: 'maxDate',
    label: 'Latest allowed',
    group: 'Behavior',
    editor: { kind: 'text', placeholder: 'e.g. 2030-12-31' },
  },
];

/* -------------------------------------------------------------------------- */
/* Per-type specs                                                              */
/* -------------------------------------------------------------------------- */

const inputSpecs: PropSpec[] = [
  prefixSpec,
  suffixSpec,
  variantSpec,
  sizeSpec,
  maxLengthSpec,
  {
    key: 'inputType',
    label: 'Input type',
    group: 'Behavior',
    editor: {
      kind: 'select',
      options: [
        { label: 'Text', value: '' },
        { label: 'Email', value: 'email' },
        { label: 'Telephone', value: 'tel' },
        { label: 'URL', value: 'url' },
        { label: 'Search', value: 'search' },
      ],
    },
    default: '',
    help: 'Native input type — drives the mobile keyboard.',
  },
  allowClearSpec,
  readOnlySpec,
];

const passwordSpecs: PropSpec[] = [
  prefixSpec,
  variantSpec,
  sizeSpec,
  maxLengthSpec,
  {
    key: 'visibilityToggle',
    label: 'Show the reveal icon',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: true,
  },
  readOnlySpec,
];

const textareaSpecs: PropSpec[] = [
  variantSpec,
  sizeSpec,
  { key: 'rows', label: 'Rows', group: 'Appearance', editor: { kind: 'number', min: 1 }, default: 4 },
  {
    key: 'autoSize',
    label: 'Grow with content',
    group: 'Appearance',
    editor: { kind: 'bool' },
    default: false,
  },
  {
    key: 'minRows',
    label: 'Min rows',
    group: 'Appearance',
    editor: { kind: 'number', min: 1 },
    when: (node) => node.props?.autoSize === true,
  },
  {
    key: 'maxRows',
    label: 'Max rows',
    group: 'Appearance',
    editor: { kind: 'number', min: 1 },
    when: (node) => node.props?.autoSize === true,
  },
  maxLengthSpec,
  {
    key: 'showCount',
    label: 'Show character count',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
  },
  allowClearOffSpec,
  readOnlySpec,
];

const numberSpecs: PropSpec[] = [
  prefixSpec,
  suffixSpec,
  variantSpec,
  sizeSpec,
  { key: 'min', label: 'Minimum', group: 'Behavior', editor: { kind: 'number' } },
  { key: 'max', label: 'Maximum', group: 'Behavior', editor: { kind: 'number' } },
  { key: 'step', label: 'Step', group: 'Behavior', editor: { kind: 'number' }, default: 1 },
  {
    key: 'controls',
    label: 'Show the up/down arrows',
    group: 'Appearance',
    editor: { kind: 'bool' },
    default: true,
  },
  {
    key: 'keyboard',
    label: 'Arrow keys change the value',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: true,
  },
  readOnlySpec,
  {
    key: 'precision',
    label: 'Decimal places',
    group: 'Format',
    editor: { kind: 'number', min: 0 },
  },
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
    help: 'Display only. The submitted value stays a plain number.',
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
  {
    key: 'stringMode',
    label: 'Keep the value as a string',
    group: 'Format',
    editor: { kind: 'bool' },
    default: false,
    help: 'For numbers beyond the safe integer range.',
  },
];

const isMultiSelect = (node: FieldNode) =>
  node.props?.mode === 'multiple' || node.props?.mode === 'tags';

const selectSpecs: PropSpec[] = [
  prefixSpec,
  variantSpec,
  sizeSpec,
  {
    key: 'mode',
    label: 'Selection mode',
    group: 'Behavior',
    editor: {
      kind: 'select',
      options: [
        { label: 'Single', value: '' },
        { label: 'Multiple', value: 'multiple' },
        { label: 'Tags (free text)', value: 'tags' },
      ],
    },
    default: '',
  },
  {
    key: 'showSearch',
    label: 'Searchable',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    lockedWhen: (node) =>
      node.dataSource?.search
        ? 'Always on while the options are searched on the server.'
        : undefined,
  },
  {
    key: 'maxTagCount',
    label: 'Max tags shown',
    group: 'Appearance',
    editor: {
      kind: 'combo',
      options: [
        { label: 'No limit', value: '' },
        { label: 'Fit the width (responsive)', value: 'responsive' },
        { label: '1', value: '1' },
        { label: '3', value: '3' },
      ],
      placeholder: 'No limit',
    },
    default: '',
    when: isMultiSelect,
  },
  {
    key: 'maxCount',
    label: 'Max selections',
    group: 'Behavior',
    editor: { kind: 'number', min: 1 },
    when: isMultiSelect,
  },
  {
    key: 'placement',
    label: 'Dropdown placement',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Auto', value: '' },
        { label: 'Bottom left', value: 'bottomLeft' },
        { label: 'Bottom right', value: 'bottomRight' },
        { label: 'Top left', value: 'topLeft' },
        { label: 'Top right', value: 'topRight' },
      ],
    },
    default: '',
  },
  allowClearSpec,
  readOnlySpec,
];

const radioSpecs: PropSpec[] = [
  {
    key: 'button',
    label: 'Render as button group',
    group: 'Appearance',
    editor: { kind: 'bool' },
    default: false,
  },
  {
    key: 'buttonStyle',
    label: 'Button style',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Outline', value: '' },
        { label: 'Solid', value: 'solid' },
      ],
    },
    default: '',
    when: (node) => node.props?.button === true,
  },
  { ...sizeSpec, when: (node) => node.props?.button === true },
  {
    key: 'block',
    label: 'Fill the available width',
    group: 'Appearance',
    editor: { kind: 'bool' },
    default: false,
  },
];

const switchSpecs: PropSpec[] = [
  {
    key: 'checkedChildren',
    label: 'Label when on',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: 'e.g. Yes' },
  },
  {
    key: 'unCheckedChildren',
    label: 'Label when off',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: 'e.g. No' },
  },
  {
    key: 'size',
    label: 'Size',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Default', value: '' },
        { label: 'Small', value: 'small' },
      ],
    },
    default: '',
  },
];

const dateSpecs: PropSpec[] = [
  prefixSpec,
  ...pickerAppearance,
  {
    key: 'picker',
    label: 'Granularity',
    group: 'Behavior',
    editor: {
      kind: 'select',
      options: [
        { label: 'Date', value: 'date' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
        { label: 'Quarter', value: 'quarter' },
        { label: 'Year', value: 'year' },
      ],
    },
    default: 'date',
  },
  {
    key: 'showTime',
    label: 'Include time',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    when: (node) => (node.props?.picker ?? 'date') === 'date',
  },
  ...dateBoundSpecs,
  ...pickerBehaviour,
  displayFormatSpec(DATE_FORMAT_PRESETS),
  valueFormatSpec,
];

const dateRangeSpecs: PropSpec[] = [
  prefixSpec,
  ...pickerAppearance,
  {
    key: 'startPlaceholder',
    label: 'Start placeholder',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: 'Start date' },
  },
  {
    key: 'endPlaceholder',
    label: 'End placeholder',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: 'End date' },
  },
  {
    key: 'separator',
    label: 'Separator',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: '→' },
  },
  {
    key: 'picker',
    label: 'Granularity',
    group: 'Behavior',
    editor: {
      kind: 'select',
      options: [
        { label: 'Date', value: 'date' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
        { label: 'Quarter', value: 'quarter' },
        { label: 'Year', value: 'year' },
      ],
    },
    default: 'date',
  },
  {
    key: 'showTime',
    label: 'Include time',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
    when: (node) => (node.props?.picker ?? 'date') === 'date',
  },
  {
    key: 'order',
    label: 'Sort the two dates automatically',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: true,
  },
  ...dateBoundSpecs,
  ...pickerBehaviour,
  displayFormatSpec(DATE_FORMAT_PRESETS),
  valueFormatSpec,
];

const timeSpecs: PropSpec[] = [
  ...pickerAppearance,
  {
    key: 'use12Hours',
    label: '12-hour clock',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: false,
  },
  { key: 'hourStep', label: 'Hour step', group: 'Behavior', editor: { kind: 'number', min: 1, max: 23 } },
  { key: 'minuteStep', label: 'Minute step', group: 'Behavior', editor: { kind: 'number', min: 1, max: 59 } },
  { key: 'secondStep', label: 'Second step', group: 'Behavior', editor: { kind: 'number', min: 1, max: 59 } },
  ...pickerBehaviour,
  displayFormatSpec(TIME_FORMAT_PRESETS),
  valueFormatSpec,
];

const sliderSpecs: PropSpec[] = [
  { key: 'min', label: 'Minimum', group: 'Behavior', editor: { kind: 'number' }, default: 0 },
  { key: 'max', label: 'Maximum', group: 'Behavior', editor: { kind: 'number' }, default: 100 },
  { key: 'step', label: 'Step', group: 'Behavior', editor: { kind: 'number', min: 1 }, default: 1 },
  {
    key: 'unit',
    label: 'Tooltip unit',
    group: 'Format',
    editor: { kind: 'text', placeholder: 'e.g. %' },
    help: 'Appended to the value in the drag tooltip.',
  },
  { key: 'dots', label: 'Show a dot at every step', group: 'Appearance', editor: { kind: 'bool' }, default: false },
  { key: 'reverse', label: 'Reverse the direction', group: 'Appearance', editor: { kind: 'bool' }, default: false },
  { key: 'vertical', label: 'Vertical', group: 'Appearance', editor: { kind: 'bool' }, default: false },
];

const rateSpecs: PropSpec[] = [
  { key: 'count', label: 'Star count', group: 'Behavior', editor: { kind: 'number', min: 1, max: 10 }, default: 5 },
  {
    key: 'character',
    label: 'Character',
    group: 'Appearance',
    editor: { kind: 'text', placeholder: '★' },
    help: 'Any single character or emoji. Blank uses the antd star.',
  },
  { key: 'allowHalf', label: 'Allow half stars', group: 'Behavior', editor: { kind: 'bool' }, default: false },
  {
    key: 'allowClear',
    label: 'Clicking the current value clears it',
    group: 'Behavior',
    editor: { kind: 'bool' },
    default: true,
  },
];

const uploadSpecs: PropSpec[] = [
  { key: 'buttonText', label: 'Button text', group: 'Appearance', editor: { kind: 'text' }, default: 'Select file' },
  {
    key: 'listType',
    label: 'File list style',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Text', value: '' },
        { label: 'Picture', value: 'picture' },
        { label: 'Picture card', value: 'picture-card' },
        { label: 'Picture circle', value: 'picture-circle' },
      ],
    },
    default: '',
  },
  { key: 'showUploadList', label: 'Show the file list', group: 'Appearance', editor: { kind: 'bool' }, default: true },
  {
    key: 'accept',
    label: 'Accepted types',
    group: 'Behavior',
    editor: { kind: 'text', placeholder: 'e.g. .pdf,image/*' },
    help: 'Passed to the native file dialog.',
  },
  { key: 'maxCount', label: 'Max files', group: 'Behavior', editor: { kind: 'number', min: 1 } },
  { key: 'multiple', label: 'Allow multiple files', group: 'Behavior', editor: { kind: 'bool' }, default: false },
];

const titleSpecs: PropSpec[] = [
  {
    key: 'level',
    label: 'Heading level',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [1, 2, 3, 4, 5].map((level) => ({ label: `H${level}`, value: level })),
    },
    default: 4,
  },
  {
    key: 'type',
    label: 'Emphasis',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Default', value: '' },
        { label: 'Secondary', value: 'secondary' },
        { label: 'Success', value: 'success' },
        { label: 'Warning', value: 'warning' },
        { label: 'Danger', value: 'danger' },
      ],
    },
    default: '',
  },
  { key: 'italic', label: 'Italic', group: 'Appearance', editor: { kind: 'bool' }, default: false },
  { key: 'underline', label: 'Underline', group: 'Appearance', editor: { kind: 'bool' }, default: false },
];

const dividerSpecs: PropSpec[] = [
  {
    key: 'titlePlacement',
    label: 'Text placement',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Start', value: 'start' },
        { label: 'Center', value: 'center' },
        { label: 'End', value: 'end' },
      ],
    },
    default: 'start',
  },
  {
    key: 'variant',
    label: 'Line style',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Solid', value: '' },
        { label: 'Dashed', value: 'dashed' },
        { label: 'Dotted', value: 'dotted' },
      ],
    },
    default: '',
  },
  {
    key: 'size',
    label: 'Spacing',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Default', value: '' },
        { label: 'Small', value: 'small' },
        { label: 'Middle', value: 'middle' },
        { label: 'Large', value: 'large' },
      ],
    },
    default: '',
  },
  { key: 'plain', label: 'Plain text (not bold)', group: 'Appearance', editor: { kind: 'bool' }, default: false },
];

const cardSpecs: PropSpec[] = [
  {
    key: 'size',
    label: 'Card size',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Medium', value: 'medium' },
        { label: 'Small', value: 'small' },
      ],
    },
    default: 'medium',
  },
  {
    key: 'variant',
    label: 'Border',
    group: 'Appearance',
    editor: {
      kind: 'select',
      options: [
        { label: 'Outlined', value: 'outlined' },
        { label: 'Borderless', value: 'borderless' },
      ],
    },
    default: 'outlined',
  },
];

export const TYPE_PROP_SPECS: Record<FieldType, PropSpec[]> = {
  input: inputSpecs,
  textarea: textareaSpecs,
  password: passwordSpecs,
  number: numberSpecs,
  select: selectSpecs,
  radio: radioSpecs,
  checkboxGroup: [],
  checkbox: [
    { key: 'text', label: 'Checkbox text', group: 'Appearance', editor: { kind: 'text' } },
  ],
  switch: switchSpecs,
  date: dateSpecs,
  dateRange: dateRangeSpecs,
  time: timeSpecs,
  slider: sliderSpecs,
  rate: rateSpecs,
  upload: uploadSpecs,
  divider: dividerSpecs,
  title: titleSpecs,
  group: [],
  card: cardSpecs,
  // Repeatable rows are configured through `listConfig`, not `props` — the
  // inspector renders that section by hand.
  list: [],
};

export function specsFor(type: FieldType): PropSpec[] {
  return TYPE_PROP_SPECS[type] ?? [];
}

/** Does this type have a settings section at all? Keeps the inspector blank-free. */
export function hasTypeProps(type: FieldType): boolean {
  return type === 'list' || specsFor(type).length > 0;
}
