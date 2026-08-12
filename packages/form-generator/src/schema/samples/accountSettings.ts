import type { ScreenSchema } from '../screen';
import { screenSchemaSchema } from '../screen';

/**
 * A long screen, sectioned — what tabs are for.
 *
 * Also the reference for how containers nest. Every level the rules allow is
 * used exactly once:
 *
 *     root > tabs > card > repeatable
 *
 * A tab *is* a card, which is what keeps the schema flat: `children` is still
 * one array of nodes, so nothing about the tree walking, the drag and drop or
 * the payload had to learn a second shape. The tab's title is the card's own
 * label.
 *
 * Two things to try in the Preview:
 *
 * - Submit with the Security tab never opened. Its password still validates and
 *   still reaches the payload, because a hidden pane stays mounted — antd
 *   unmounting it would take the value with it.
 * - Collapse "Mailing address" and submit. Folding a section hides it; it does
 *   not remove what it collected.
 */
export const accountSettingsPreset = {
  key: 'account-settings',
  label: 'Account settings',
  description: 'A long screen split into tabs, with a collapsible section and a repeatable inside one.',
  create: (): ScreenSchema =>
    screenSchemaSchema.parse({
      title: 'Account settings',
      description: 'Everything about your account, grouped so the page stays short.',
      maxWidth: 820,
      submitText: 'Save changes',
      showReset: true,
      nodes: [
        {
          id: 'as_tabs',
          type: 'tabs',
          children: [
            /* ---------------------------------------------------------- */
            {
              id: 'as_tab_profile',
              type: 'card',
              label: 'Profile',
              props: { variant: 'borderless' },
              children: [
                {
                  id: 'as_name',
                  type: 'input',
                  name: 'fullName',
                  label: 'Full name',
                  span: 12,
                  rules: [{ kind: 'required' }],
                },
                {
                  id: 'as_email',
                  type: 'input',
                  name: 'email',
                  label: 'Email',
                  span: 12,
                  rules: [{ kind: 'required' }, { kind: 'type', value: 'email' }],
                },
                {
                  id: 'as_bio',
                  type: 'textarea',
                  name: 'bio',
                  label: 'About you',
                  props: { rows: 3, maxLength: 300, showCount: true },
                },
                // Third level: a card inside a tab, holding a repeatable.
                {
                  id: 'as_address_card',
                  type: 'card',
                  label: 'Mailing address',
                  // Collapse, reached through the card rather than a type of
                  // its own. Its fields submit whether it is open or shut.
                  props: { collapsible: true, defaultOpen: false, size: 'small' },
                  children: [
                    {
                      id: 'as_line1',
                      type: 'input',
                      name: 'addressLine',
                      label: 'Street',
                      span: 16,
                    },
                    {
                      id: 'as_postcode',
                      type: 'input',
                      name: 'postcode',
                      label: 'Postcode',
                      span: 8,
                    },
                  ],
                },
              ],
            },

            /* ---------------------------------------------------------- */
            {
              id: 'as_tab_security',
              type: 'card',
              label: 'Security',
              props: { variant: 'borderless' },
              children: [
                {
                  id: 'as_password',
                  type: 'password',
                  name: 'newPassword',
                  label: 'New password',
                  span: 12,
                  // Deliberately required and on the tab that does not open
                  // first: submitting from Profile must still enforce this.
                  rules: [{ kind: 'required' }, { kind: 'min', value: 8 }],
                },
                {
                  id: 'as_2fa',
                  type: 'switch',
                  name: 'twoFactor',
                  label: 'Two-factor authentication',
                  span: 12,
                  defaultValue: true,
                },
                {
                  id: 'as_note',
                  type: 'alert',
                  text: 'Signing out everywhere takes effect the next time each device connects.',
                  props: { tone: 'info' },
                },
              ],
            },

            /* ---------------------------------------------------------- */
            {
              id: 'as_tab_team',
              type: 'card',
              label: 'Team',
              props: { variant: 'borderless' },
              children: [
                // The repeatable sits straight in the tab. A card around it
                // would be a fourth container, which `canDropInto` refuses —
                // a sample has to be something you could have dragged together.
                {
                  id: 'as_people',
                  type: 'list',
                  name: 'team',
                  label: 'People with access',
                  listConfig: { addText: 'Invite someone', maxItems: 5 },
                  children: [
                    {
                      id: 'as_member_email',
                      type: 'input',
                      name: 'email',
                      label: 'Email',
                      span: 14,
                      rules: [{ kind: 'type', value: 'email' }],
                    },
                    {
                      id: 'as_member_role',
                      type: 'select',
                      name: 'role',
                      label: 'Role',
                      span: 10,
                      defaultValue: 'viewer',
                      options: [
                        { label: 'Viewer', value: 'viewer' },
                        { label: 'Editor', value: 'editor' },
                        { label: 'Admin', value: 'admin' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
};
