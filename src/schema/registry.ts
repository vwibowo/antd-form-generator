import type { ScreenNode, ScreenNodeType } from './screen';

/**
 * Per-type metadata driving the palette, the inspector, and node creation.
 * The renderer does NOT read this — it switches on `type` directly, so it stays
 * independent of builder concerns.
 *
 * One registry for all 38 node types. The controls a form used to own and the
 * display blocks a page used to own are the same kind of entry; what separates
 * them is `supports`, not which file they live in.
 */

export type NodeCategory =
  | 'Basic'
  | 'Choice'
  | 'Date & time'
  | 'Advanced'
  | 'Content'
  | 'Data'
  | 'Layout'
  | 'Actions'
  | 'Custom';

export interface NodeSupports {
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
  /** Node carries a value (has a `name` that reaches the payload). */
  value: boolean;
  /** Shows the text area — `{{token}}` capable. */
  text: boolean;
  /** Shows the image source and alt inputs. */
  image: boolean;
  /** Shows the label/value row editor. */
  items: boolean;
  /** Shows the button list editor. */
  actions: boolean;
  /** Shows the embedded table editor. */
  table: boolean;
  /** Shows the screen-source picker. */
  summarySource: boolean;
}

export interface NodeMeta {
  type: ScreenNodeType;
  label: string;
  category: NodeCategory;
  /** One line under the palette entry. Absent where the label says it all. */
  hint?: string;
  /** Base for auto-generated names, e.g. `email`, `email2`. */
  namePrefix: string;
  supports: NodeSupports;
  /** Seed values merged into a freshly created node. */
  defaults: Partial<ScreenNode>;
}

/** Every display-only switch off. Spread over, never used directly. */
const none = {
  text: false,
  image: false,
  items: false,
  actions: false,
  table: false,
  summarySource: false,
} as const;

const base: NodeSupports = {
  placeholder: true,
  options: false,
  treeOptions: false,
  rules: true,
  defaultValue: true,
  children: false,
  value: true,
  ...none,
};

const noPlaceholder: NodeSupports = { ...base, placeholder: false };

const withOptions: NodeSupports = { ...base, options: true };

/** Hierarchical options, and no flat option editor — the two are exclusive. */
const withTreeOptions: NodeSupports = { ...base, treeOptions: true };

/** Renders something rather than asking for it. */
const display: NodeSupports = {
  placeholder: false,
  options: false,
  treeOptions: false,
  rules: false,
  defaultValue: false,
  children: false,
  value: false,
  ...none,
};

const textOnly: NodeSupports = { ...display, text: true };

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

export const SCREEN_REGISTRY: Record<ScreenNodeType, NodeMeta> = {
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
    supports: display,
    defaults: { label: '' },
  },
  group: {
    type: 'group',
    label: 'Group',
    category: 'Layout',
    namePrefix: 'group',
    supports: { ...display, children: true },
    defaults: { label: 'Group', children: [] },
  },
  card: {
    type: 'card',
    label: 'Card',
    category: 'Layout',
    namePrefix: 'card',
    supports: { ...display, children: true },
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
    supports: { ...display, children: true, value: true },
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
  heading: {
    type: 'heading',
    label: 'Heading',
    category: 'Content',
    hint: 'A section title',
    namePrefix: 'heading',
    supports: textOnly,
    defaults: { text: 'Heading', props: { level: 3 } },
  },
  text: {
    type: 'text',
    label: 'Paragraph',
    category: 'Content',
    hint: 'Prose, with {{field}} filled in from the payload',
    namePrefix: 'text',
    supports: textOnly,
    defaults: { text: 'Tell the reader what happens next.' },
  },
  image: {
    type: 'image',
    label: 'Image',
    category: 'Content',
    hint: 'A picture from a URL',
    namePrefix: 'image',
    supports: { ...display, image: true },
    defaults: { alt: '', props: { rounded: true } },
  },
  alert: {
    type: 'alert',
    label: 'Callout',
    category: 'Content',
    hint: 'Something the reader must not miss',
    namePrefix: 'callout',
    supports: textOnly,
    defaults: { text: 'Keep this reference for your records.', props: { tone: 'info' } },
  },
  dataList: {
    type: 'dataList',
    label: 'Data list',
    category: 'Data',
    hint: 'Label and value rows read from the payload',
    namePrefix: 'details',
    supports: { ...display, items: true },
    defaults: {
      items: [{ label: 'Reference', value: '{{reference}}' }],
      props: { columns: 1, bordered: true },
    },
  },
  summary: {
    type: 'summary',
    label: 'Screen summary',
    category: 'Data',
    hint: 'Everything an earlier screen collected, laid out by that screen',
    namePrefix: 'summary',
    supports: { ...display, summarySource: true },
    defaults: { props: { columns: 2, bordered: true } },
  },
  table: {
    type: 'table',
    label: 'Table',
    category: 'Data',
    hint: 'An embedded table document',
    namePrefix: 'table',
    supports: { ...display, table: true },
    defaults: {},
  },
  tabs: {
    type: 'tabs',
    label: 'Tabs',
    category: 'Layout',
    hint: 'Sections a long screen. Each tab is a card',
    namePrefix: 'tabs',
    supports: { ...display, children: true },
    // Children are seeded by `createNode`, which needs fresh ids per instance.
    defaults: { children: [] },
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer',
    category: 'Layout',
    hint: 'Vertical breathing room',
    namePrefix: 'spacer',
    supports: display,
    defaults: { props: { height: 24 } },
  },
  actions: {
    type: 'actions',
    label: 'Buttons',
    category: 'Actions',
    hint: 'What the reader can do next — each one can drive a branch',
    namePrefix: 'actions',
    supports: { ...display, actions: true },
    defaults: {
      actions: [{ id: 'continue', label: 'Continue', variant: 'primary', danger: false }],
      props: { align: 'left' },
    },
  },
};

export const NODE_CATEGORIES: NodeCategory[] = [
  'Basic',
  'Choice',
  'Date & time',
  'Advanced',
  'Content',
  'Data',
  'Layout',
  'Actions',
  'Custom',
];

export function nodesByCategory(category: NodeCategory): NodeMeta[] {
  return Object.values(SCREEN_REGISTRY).filter((meta) => meta.category === category);
}

export function metaFor(type: ScreenNodeType): NodeMeta {
  return SCREEN_REGISTRY[type];
}
