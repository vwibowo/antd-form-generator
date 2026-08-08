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
  rules: true,
  defaultValue: true,
  children: false,
  value: true,
};

const noPlaceholder: FieldSupports = { ...base, placeholder: false };

const withOptions: FieldSupports = { ...base, options: true };

const presentational: FieldSupports = {
  placeholder: false,
  options: false,
  rules: false,
  defaultValue: false,
  children: false,
  value: false,
};

const seedOptions = [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' },
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
  select: {
    type: 'select',
    label: 'Select',
    category: 'Choice',
    namePrefix: 'select',
    supports: withOptions,
    defaults: { label: 'Select', placeholder: 'Choose one', options: seedOptions },
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
