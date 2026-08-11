import type { PageBlock, PageBlockType } from './page';

/**
 * Per-type metadata driving the block palette, the inspector and block
 * creation. The renderer does NOT read this — it switches on `type` directly,
 * so it stays independent of builder concerns, exactly as `registry.ts` does
 * for fields.
 */

export type PageBlockCategory = 'Content' | 'Data' | 'Layout' | 'Actions';

export const PAGE_BLOCK_CATEGORIES: PageBlockCategory[] = [
  'Content',
  'Data',
  'Layout',
  'Actions',
];

export interface PageBlockSupports {
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
  /** Shows the form-source picker. */
  summarySource: boolean;
}

export interface PageBlockMeta {
  type: PageBlockType;
  label: string;
  category: PageBlockCategory;
  /** One line under the palette entry. */
  hint: string;
  supports: PageBlockSupports;
  /** Seed values merged into a freshly created block. */
  defaults: Partial<PageBlock>;
}

const nothing: PageBlockSupports = {
  text: false,
  image: false,
  items: false,
  actions: false,
  table: false,
  summarySource: false,
};

const textOnly: PageBlockSupports = { ...nothing, text: true };

export const PAGE_BLOCK_REGISTRY: Record<PageBlockType, PageBlockMeta> = {
  heading: {
    type: 'heading',
    label: 'Heading',
    category: 'Content',
    hint: 'A section title',
    supports: textOnly,
    defaults: { text: 'Heading', props: { level: 3 } },
  },
  text: {
    type: 'text',
    label: 'Paragraph',
    category: 'Content',
    hint: 'Prose, with {{field}} filled in from the payload',
    supports: textOnly,
    defaults: { text: 'Tell the reader what happens next.' },
  },
  image: {
    type: 'image',
    label: 'Image',
    category: 'Content',
    hint: 'A picture from a URL',
    supports: { ...nothing, image: true },
    defaults: { alt: '', props: { rounded: true } },
  },
  alert: {
    type: 'alert',
    label: 'Callout',
    category: 'Content',
    hint: 'Something the reader must not miss',
    supports: textOnly,
    defaults: { text: 'Keep this reference for your records.', props: { tone: 'info' } },
  },
  dataList: {
    type: 'dataList',
    label: 'Data list',
    category: 'Data',
    hint: 'Label and value rows read from the payload',
    supports: { ...nothing, items: true },
    defaults: {
      items: [{ label: 'Reference', value: '{{reference}}' }],
      props: { columns: 1, bordered: true },
    },
  },
  summary: {
    type: 'summary',
    label: 'Form summary',
    category: 'Data',
    hint: "Everything a form step collected, laid out by that form",
    supports: { ...nothing, summarySource: true },
    defaults: { props: { columns: 2, bordered: true } },
  },
  table: {
    type: 'table',
    label: 'Table',
    category: 'Data',
    hint: 'An embedded table document',
    supports: { ...nothing, table: true },
    defaults: {},
  },
  divider: {
    type: 'divider',
    label: 'Divider',
    category: 'Layout',
    hint: 'A horizontal rule',
    supports: nothing,
    defaults: {},
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer',
    category: 'Layout',
    hint: 'Vertical breathing room',
    supports: nothing,
    defaults: { props: { height: 24 } },
  },
  actions: {
    type: 'actions',
    label: 'Buttons',
    category: 'Actions',
    hint: 'What the reader can do next — each one can drive a branch',
    supports: { ...nothing, actions: true },
    defaults: {
      actions: [{ id: 'continue', label: 'Continue', variant: 'primary', danger: false }],
      props: { align: 'left' },
    },
  },
};

export function pageBlockMetaFor(type: PageBlockType): PageBlockMeta {
  return PAGE_BLOCK_REGISTRY[type];
}

export function pageBlocksByCategory(category: PageBlockCategory): PageBlockMeta[] {
  return Object.values(PAGE_BLOCK_REGISTRY).filter((meta) => meta.category === category);
}
