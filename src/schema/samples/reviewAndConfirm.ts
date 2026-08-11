import type { ScreenSchema } from '../screen';
import { screenSchemaSchema } from '../screen';

/**
 * The screen that both asks and tells — the one the form/page split made
 * impossible.
 *
 * Before the merge this needed a page document for the heading, the callout and
 * the buttons, and a form document for the two fields, and there was no way to
 * put them on the same screen. Everything here is one `ScreenSchema`.
 *
 * Three things it demonstrates that no other sample does:
 *
 * - **Display and control side by side.** A `heading`, a `text` and an `alert`
 *   sit between the inputs, in the same 24-column grid.
 * - **`{{token}}` against live form state.** The data list echoes what is being
 *   typed *now*. Each row watches only the names it mentions, so this costs one
 *   subscription per row rather than a re-render of the screen per keystroke.
 * - **Buttons instead of a submit row.** `showsSubmitRow` sees the `actions`
 *   node and suppresses the built-in row, so there is one way onward rather
 *   than two. Pressing either button validates first, then contributes the
 *   typed values *and* the button's id — which is exactly what a workflow
 *   branch reads.
 *
 * A `summary` node would be the richer way to echo the payload, but it needs an
 * earlier step to take its layout from and renders nothing on a standalone
 * screen. `dataList` is the equivalent that works on its own.
 */
export const reviewAndConfirmPreset = {
  key: 'review-and-confirm',
  label: 'Review and confirm',
  description: 'Asks and tells on one screen — fields, a live summary, and buttons instead of Submit.',
  create: (): ScreenSchema =>
    screenSchemaSchema.parse({
      title: 'Confirm your order',
      description: 'Check the details, then choose how to continue.',
      maxWidth: 720,
      nodes: [
        {
          id: 'rc_heading',
          type: 'heading',
          text: 'Delivery',
          props: { level: 4 },
        },
        {
          id: 'rc_intro',
          type: 'text',
          text: 'We will send the order to the address below. You can still change it.',
        },
        {
          id: 'rc_recipient',
          type: 'input',
          name: 'recipient',
          label: 'Recipient',
          span: 12,
          placeholder: 'Who is it for?',
          rules: [{ kind: 'required' }],
        },
        {
          id: 'rc_postcode',
          type: 'input',
          name: 'postcode',
          label: 'Postcode',
          span: 12,
          placeholder: 'SW1A 1AA',
          rules: [{ kind: 'required' }],
        },
        {
          id: 'rc_speed',
          type: 'segmented',
          name: 'speed',
          label: 'Delivery speed',
          span: 12,
          defaultValue: 'standard',
          options: [
            { label: 'Standard', value: 'standard' },
            { label: 'Next day', value: 'express' },
          ],
        },
        {
          id: 'rc_gift',
          type: 'checkbox',
          name: 'giftWrap',
          label: 'Gift wrap',
          span: 12,
          defaultValue: false,
          props: { text: 'Wrap this order' },
        },

        { id: 'rc_divider', type: 'divider', label: 'Summary' },

        // Reads the live form values rather than a finished payload — this is
        // the screen summarising itself as it is filled in.
        {
          id: 'rc_summary',
          type: 'dataList',
          items: [
            { label: 'Recipient', value: '{{recipient}}' },
            { label: 'Postcode', value: '{{postcode}}' },
            { label: 'Speed', value: '{{speed}}' },
            { label: 'Gift wrapped', value: '{{giftWrap}}' },
          ],
          props: { columns: 2, bordered: true },
        },

        // Shown only for the choice that costs more, using the same
        // `ConditionGroup` a workflow branch would use.
        {
          id: 'rc_express_note',
          type: 'alert',
          text: 'Next-day delivery adds £5.99 and orders must be placed before 6pm.',
          props: { tone: 'warning' },
          condition: {
            logic: 'and',
            conditions: [{ field: 'speed', operator: 'eq', value: 'express' }],
          },
        },

        {
          id: 'rc_actions',
          type: 'actions',
          actions: [
            { id: 'confirm', label: 'Place order', variant: 'primary', danger: false },
            { id: 'later', label: 'Save for later', variant: 'default', danger: false },
          ],
        },
      ],
    }),
};
