import type { ScreenSchema } from '../screen';
import { screenSchemaSchema } from '../screen';

/**
 * The screen that only tells — what the page document used to demonstrate.
 *
 * Listed alongside the asking screens in `index.ts`; it keeps its own file
 * because it is the one sample built entirely from display nodes.
 */

/**
 * One of every display node, and every binding mechanism.
 *
 * Written loosely and run through `screenSchemaSchema.parse` so zod fills every
 * default, which doubles as a check that the defaults are sane.
 */
export const welcomePackPreset = {
  key: 'welcome-pack',
  label: 'Welcome pack',
  description: 'One of every block, bound to a payload — set values in the Preview tab.',
  create: (): ScreenSchema =>
    screenSchemaSchema.parse({
      title: 'Welcome, {{fullName}}',
      description: 'Your account is open. Here is what happens next.',
      maxWidth: 880,
      nodes: [
        {
          id: 'wp_alert',
          type: 'alert',
          text: 'Your account number is {{accountNumber}}. Keep it somewhere safe.',
          props: { tone: 'success' },
        },
        { id: 'wp_h_detail', type: 'heading', text: 'Your account', props: { level: 4 } },
        {
          id: 'wp_details',
          type: 'dataList',
          items: [
            { label: 'Name', value: '{{fullName}}' },
            { label: 'Account number', value: '{{accountNumber}}' },
            { label: 'Sort code', value: '{{sortCode}}' },
            { label: 'Opened', value: '{{openedOn}}' },
          ],
          props: { columns: 2, bordered: true },
        },
        { id: 'wp_divider', type: 'divider' },
        { id: 'wp_h_next', type: 'heading', text: 'Next steps', props: { level: 4 } },
        {
          id: 'wp_next',
          type: 'text',
          text: 'Your card arrives within five working days.\nSet up your online banking with the details above.',
        },
        {
          id: 'wp_conditional',
          type: 'alert',
          text: 'Because you asked for an overdraft, we will write to you separately about it.',
          props: { tone: 'info' },
          // Demonstrates a block condition: appears only for one payload value.
          condition: {
            logic: 'and',
            conditions: [{ field: 'overdraft', operator: 'eq', value: 'yes' }],
          },
        },
        { id: 'wp_spacer', type: 'spacer', props: { height: 8 } },
        {
          id: 'wp_actions',
          type: 'actions',
          actions: [
            { id: 'online', label: 'Set up online banking', variant: 'primary' },
            { id: 'later', label: 'I will do this later', variant: 'default' },
          ],
        },
      ],
    }),
};

