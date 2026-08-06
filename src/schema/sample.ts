import type { FormSchema } from './schema';
import { formSchemaSchema } from './schema';

/**
 * Demo schema exercising every field type plus the three features that are
 * easy to get wrong: grid columns, conditional visibility, and a repeatable
 * section whose inner condition must resolve row-locally.
 *
 * Written loosely and run through `formSchemaSchema.parse` so zod fills in
 * every default — this doubles as a check that the defaults are sane.
 */
export function createSampleSchema(): FormSchema {
  return formSchemaSchema.parse({
    title: 'Conference registration',
    description: 'A demo form showing what the generator can produce.',
    layout: 'vertical',
    submitText: 'Register',
    fields: [
      { id: 's_title', type: 'title', name: 'heading', label: 'Attendee', props: { level: 4 } },
      {
        id: 's_first',
        type: 'input',
        name: 'firstName',
        label: 'First name',
        span: 12,
        placeholder: 'Ada',
        rules: [{ kind: 'required' }],
      },
      {
        id: 's_last',
        type: 'input',
        name: 'lastName',
        label: 'Last name',
        span: 12,
        placeholder: 'Lovelace',
        rules: [{ kind: 'required' }],
      },
      {
        id: 's_email',
        type: 'input',
        name: 'email',
        label: 'Email',
        span: 12,
        placeholder: 'ada@example.com',
        rules: [{ kind: 'required' }, { kind: 'type', value: 'email' }],
      },
      {
        id: 's_password',
        type: 'password',
        name: 'password',
        label: 'Password',
        span: 12,
        rules: [{ kind: 'min', value: 8, message: 'At least 8 characters' }],
      },
      {
        id: 's_age',
        type: 'number',
        name: 'age',
        label: 'Age',
        span: 8,
        props: { min: 0, max: 120 },
        rules: [{ kind: 'min', value: 18, message: 'Must be 18 or older' }],
      },
      {
        id: 's_date',
        type: 'date',
        name: 'arrival',
        label: 'Arrival date',
        span: 8,
      },
      { id: 's_time', type: 'time', name: 'arrivalTime', label: 'Arrival time', span: 8 },
      {
        id: 's_range',
        type: 'dateRange',
        name: 'stay',
        label: 'Stay dates',
        span: 12,
      },
      {
        id: 's_ticket',
        type: 'select',
        name: 'ticket',
        label: 'Ticket type',
        span: 12,
        placeholder: 'Choose a ticket',
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Student', value: 'student' },
          { label: 'Other', value: 'other' },
        ],
        rules: [{ kind: 'required' }],
      },
      {
        // Only rendered when ticket === 'other'. Because the renderer sets
        // preserve={false}, its value also disappears from the payload.
        id: 's_ticket_other',
        type: 'input',
        name: 'ticketOther',
        label: 'Tell us which ticket',
        span: 24,
        rules: [{ kind: 'required', message: 'Required when ticket is Other' }],
        condition: {
          logic: 'and',
          conditions: [{ field: 'ticket', operator: 'eq', value: 'other' }],
        },
      },
      {
        id: 's_track',
        type: 'radio',
        name: 'track',
        label: 'Track',
        options: [
          { label: 'Frontend', value: 'fe' },
          { label: 'Backend', value: 'be' },
        ],
      },
      {
        id: 's_topics',
        type: 'checkboxGroup',
        name: 'topics',
        label: 'Topics of interest',
        options: [
          { label: 'React', value: 'react' },
          { label: 'Design systems', value: 'ds' },
          { label: 'Accessibility', value: 'a11y' },
        ],
      },
      { id: 's_divider', type: 'divider', name: 'divider', label: 'Extras' },
      {
        // A card is chrome only: everything below still lands at the top level
        // of the payload. It also holds two other containers, which is the one
        // nesting exception cards get.
        id: 's_card',
        type: 'card',
        name: 'card',
        label: 'Trip details',
        extra: 'Optional',
        children: [
          {
            id: 's_group',
            type: 'group',
            name: 'group',
            label: 'Preferences',
            children: [
              {
                id: 's_notes',
                type: 'textarea',
                name: 'notes',
                label: 'Dietary notes',
                span: 24,
                props: { rows: 3 },
              },
              { id: 's_rate', type: 'rate', name: 'excitement', label: 'Excitement', span: 12 },
              {
                id: 's_slider',
                type: 'slider',
                name: 'budget',
                label: 'Budget',
                span: 12,
                props: { min: 0, max: 1000, step: 50 },
                defaultValue: 200,
              },
            ],
          },
          {
            id: 's_list',
            type: 'list',
            name: 'guests',
            label: 'Additional guests',
            listConfig: { addText: 'Add guest', maxItems: 3 },
            children: [
              {
                id: 's_guest_name',
                type: 'input',
                name: 'name',
                label: 'Guest name',
                span: 12,
                rules: [{ kind: 'required' }],
              },
              {
                id: 's_guest_meal',
                type: 'select',
                name: 'meal',
                label: 'Meal',
                span: 12,
                options: [
                  { label: 'Standard', value: 'standard' },
                  { label: 'Vegan', value: 'vegan' },
                  { label: 'Other', value: 'other' },
                ],
              },
              {
                // Row-local condition: this must react to THIS row's meal, not
                // another row's, which is what `scopePath` in the renderer buys us.
                id: 's_guest_meal_other',
                type: 'input',
                name: 'mealOther',
                label: 'Describe the meal',
                span: 24,
                condition: {
                  logic: 'and',
                  conditions: [{ field: 'meal', operator: 'eq', value: 'other' }],
                },
              },
            ],
          },
        ],
      },
      {
        id: 's_upload',
        type: 'upload',
        name: 'avatar',
        label: 'Profile photo',
        props: { buttonText: 'Select image' },
      },
      {
        id: 's_switch',
        type: 'switch',
        name: 'newsletter',
        label: 'Newsletter',
        span: 12,
        defaultValue: true,
      },
      {
        id: 's_checkbox',
        type: 'checkbox',
        name: 'terms',
        label: 'Terms',
        span: 12,
        props: { text: 'I accept the terms' },
        rules: [{ kind: 'required', message: 'You must accept the terms' }],
      },
    ],
  });
}
