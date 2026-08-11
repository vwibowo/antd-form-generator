import type { FieldNode, FieldType } from './schema';

/**
 * Per-type metadata driving the palette, the inspector, and field creation.
 * The renderer does NOT read this — it switches on `type` directly, so it stays
 * independent of builder concerns.
 */

export type FieldCategory =
  | 'Basic'
  | 'Choice'
  | 'Date & time'
  | 'Advanced'
  | 'Layout'
  | 'Custom';

export interface FieldSupports {
  /** Shows the placeholder input in the inspector. */
  placeholder: boolean;
  /** Shows the option list editor (select / radio / checkbox group). */
  options: boolean;
  /** Shows the nested option editor instead — `cascader` and `treeSelect`. */
  treeOptions: boolean;
  /** Shows the validation rule editor. */
  rules: boolean;
  /** Shows the default-value input. */
  defaultValue: boolean;
  /** Node holds children and accepts drops. */
  children: boolean;
  /** Node carries a form value (has a `name` that reaches the payload). */
  value: boolean;
}

export interface FieldMeta {
  type: FieldType;
  label: string;
  category: FieldCategory;
  /** Base for auto-generated field names, e.g. `email`, `email2`. */
  namePrefix: string;
  supports: FieldSupports;
  /** Seed values merged into a freshly created node. */
  defaults: Partial<FieldNode>;
}

const base: FieldSupports = {
  placeholder: true,
  options: false,
  treeOptions: false,
  rules: true,
  defaultValue: true,
  children: false,
  value: true,
};

const noPlaceholder: FieldSupports = { ...base, placeholder: false };

const withOptions: FieldSupports = { ...base, options: true };

/** Hierarchical options, and no flat option editor — the two are exclusive. */
const withTreeOptions: FieldSupports = { ...base, treeOptions: true };

const presentational: FieldSupports = {
  placeholder: false,
  options: false,
  treeOptions: false,
  rules: false,
  defaultValue: false,
  children: false,
  value: false,
};

const seedOptions = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
];

/** Two levels, so a freshly dropped cascader already demonstrates nesting. */
const seedTreeOptions = [
  {
    label: 'Group A',
    value: 'a',
    children: [
      { label: 'A one', value: 'a1' },
      { label: 'A two', value: 'a2' },
    ],
  },
  {
    label: 'Group B',
    value: 'b',
    children: [{ label: 'B one', value: 'b1' }],
  },
];

export const FIELD_REGISTRY: Record<FieldType, FieldMeta> = {
  input: {
    type: 'input',
    label: 'Text',
    category: 'Basic',
    namePrefix: 'text',
    supports: base,
    defaults: { label: 'Text', placeholder: 'Enter text' },
  },
  textarea: {
    type: 'textarea',
    label: 'Textarea',
    category: 'Basic',
    namePrefix: 'textarea',
    supports: base,
    defaults: { label: 'Description', placeholder: 'Enter text', props: { rows: 4 } },
  },
  password: {
    type: 'password',
    label: 'Password',
    category: 'Basic',
    namePrefix: 'password',
    supports: base,
    defaults: { label: 'Password', placeholder: 'Enter password' },
  },
  number: {
    type: 'number',
    label: 'Number',
    category: 'Basic',
    namePrefix: 'number',
    supports: base,
    defaults: { label: 'Number', placeholder: 'Enter a number' },
  },
  otp: {
    type: 'otp',
    label: 'One-time code',
    category: 'Basic',
    namePrefix: 'code',
    // `Input.OTP` renders its own boxes and has nowhere to put placeholder text.
    supports: noPlaceholder,
    defaults: { label: 'Verification code', props: { length: 6 } },
  },
  autoComplete: {
    type: 'autoComplete',
    label: 'Autocomplete',
    category: 'Basic',
    namePrefix: 'lookup',
    // Free text plus suggestions, so it gets remote options for nothing.
    supports: withOptions,
    defaults: { label: 'Search', placeholder: 'Start typing', options: seedOptions },
  },
  mentions: {
    type: 'mentions',
    label: 'Mentions',
    category: 'Basic',
    namePrefix: 'note',
    supports: withOptions,
    defaults: { label: 'Note', placeholder: 'Type @ to mention someone', options: seedOptions },
  },
  select: {
    type: 'select',
    label: 'Select',
    category: 'Choice',
    namePrefix: 'select',
    supports: withOptions,
    defaults: { label: 'Select', placeholder: 'Choose one', options: seedOptions },
  },
  segmented: {
    type: 'segmented',
    label: 'Segmented',
    category: 'Choice',
    namePrefix: 'choice',
    supports: { ...withOptions, placeholder: false },
    defaults: { label: 'Choose one', options: seedOptions, defaultValue: 'a' },
  },
  cascader: {
    type: 'cascader',
    label: 'Cascader',
    category: 'Choice',
    namePrefix: 'cascade',
    supports: withTreeOptions,
    defaults: { label: 'Category', placeholder: 'Choose a path', treeOptions: seedTreeOptions },
  },
  treeSelect: {
    type: 'treeSelect',
    label: 'Tree select',
    category: 'Choice',
    namePrefix: 'tree',
    supports: withTreeOptions,
    defaults: { label: 'Pick from a tree', placeholder: 'Choose one', treeOptions: seedTreeOptions },
  },
  transfer: {
    type: 'transfer',
    label: 'Transfer',
    category: 'Choice',
    namePrefix: 'picked',
    // Two panes of its own, so there is nowhere a placeholder would show.
    supports: { ...withOptions, placeholder: false },
    defaults: { label: 'Move what applies', options: seedOptions },
  },
  radio: {
    type: 'radio',
    label: 'Radio group',
    category: 'Choice',
    namePrefix: 'radio',
    supports: { ...withOptions, placeholder: false },
    defaults: { label: 'Radio group', options: seedOptions },
  },
  checkboxGroup: {
    type: 'checkboxGroup',
    label: 'Checkbox group',
    category: 'Choice',
    namePrefix: 'checkboxGroup',
    supports: { ...withOptions, placeholder: false },
    defaults: { label: 'Checkbox group', options: seedOptions },
  },
  checkbox: {
    type: 'checkbox',
    label: 'Checkbox',
    category: 'Choice',
    namePrefix: 'checkbox',
    supports: noPlaceholder,
    defaults: { label: 'Checkbox', props: { text: 'I agree' }, defaultValue: false },
  },
  switch: {
    type: 'switch',
    label: 'Switch',
    category: 'Choice',
    namePrefix: 'switch',
    supports: noPlaceholder,
    defaults: { label: 'Switch', defaultValue: false },
  },
  date: {
    type: 'date',
    label: 'Date',
    category: 'Date & time',
    namePrefix: 'date',
    supports: base,
    defaults: { label: 'Date', placeholder: 'Select date', props: { picker: 'date' } },
  },
  dateRange: {
    type: 'dateRange',
    label: 'Date range',
    category: 'Date & time',
    namePrefix: 'dateRange',
    supports: base,
    defaults: { label: 'Date range' },
  },
  time: {
    type: 'time',
    label: 'Time',
    category: 'Date & time',
    namePrefix: 'time',
    supports: base,
    defaults: { label: 'Time', placeholder: 'Select time' },
  },
  timeRange: {
    type: 'timeRange',
    label: 'Time range',
    category: 'Date & time',
    // Two placeholders of its own, edited as start/end props like `dateRange`.
    namePrefix: 'timeRange',
    supports: { ...base, placeholder: false },
    defaults: {
      label: 'Between',
      props: { startPlaceholder: 'From', endPlaceholder: 'To' },
    },
  },
  slider: {
    type: 'slider',
    label: 'Slider',
    category: 'Advanced',
    namePrefix: 'slider',
    supports: noPlaceholder,
    defaults: { label: 'Slider', props: { min: 0, max: 100, step: 1 }, defaultValue: 0 },
  },
  rate: {
    type: 'rate',
    label: 'Rate',
    category: 'Advanced',
    namePrefix: 'rate',
    supports: noPlaceholder,
    defaults: { label: 'Rating', props: { count: 5 }, defaultValue: 0 },
  },
  colorPicker: {
    type: 'colorPicker',
    label: 'Colour',
    category: 'Advanced',
    namePrefix: 'colour',
    supports: noPlaceholder,
    defaults: { label: 'Colour', defaultValue: '#1677ff' },
  },
  upload: {
    type: 'upload',
    label: 'Upload',
    category: 'Advanced',
    namePrefix: 'upload',
    supports: { ...noPlaceholder, defaultValue: false },
    defaults: { label: 'Attachment', props: { buttonText: 'Select file', multiple: false } },
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    category: 'Layout',
    namePrefix: 'divider',
    supports: presentational,
    defaults: { label: '' },
  },
  title: {
    type: 'title',
    label: 'Heading',
    category: 'Layout',
    namePrefix: 'title',
    supports: presentational,
    defaults: { label: 'Section heading', props: { level: 4 } },
  },
  group: {
    type: 'group',
    label: 'Group',
    category: 'Layout',
    namePrefix: 'group',
    supports: { ...presentational, children: true },
    defaults: { label: 'Group', children: [] },
  },
  card: {
    type: 'card',
    label: 'Card',
    category: 'Layout',
    namePrefix: 'card',
    supports: { ...presentational, children: true },
    defaults: {
      label: 'Card title',
      children: [],
      props: { size: 'medium', variant: 'outlined' },
    },
  },
  list: {
    type: 'list',
    label: 'Repeatable',
    category: 'Layout',
    namePrefix: 'items',
    supports: {
      placeholder: false,
      options: false,
      treeOptions: false,
      rules: false,
      defaultValue: false,
      children: true,
      value: true,
    },
    defaults: {
      label: 'Repeatable section',
      children: [],
      listConfig: { addText: 'Add item' },
    },
  },
  custom: {
    type: 'custom',
    label: 'Custom component',
    category: 'Custom',
    namePrefix: 'custom',
    // The component decides what it needs; the inspector still offers the
    // common wrapper settings plus whatever the component's own specs declare.
    supports: base,
    defaults: { label: 'Custom field' },
  },
};

export const FIELD_CATEGORIES: FieldCategory[] = [
  'Basic',
  'Choice',
  'Date & time',
  'Advanced',
  'Layout',
  'Custom',
];

export function fieldsByCategory(category: FieldCategory): FieldMeta[] {
  return Object.values(FIELD_REGISTRY).filter((meta) => meta.category === category);
}

export function metaFor(type: FieldType): FieldMeta {
  return FIELD_REGISTRY[type];
}
