import type { FormSchema } from '../schema';
import { formSchemaSchema } from '../schema';

/**
 * Flagship demo: a procurement request that grows as the amount does.
 *
 * Deliberately lazy on the network — opening the Preview fires exactly one
 * request (the category list). Everything else is gated:
 *   - `lineItems.product` has no rows on mount, and `{{category}}` is blank
 *   - `budgetOwner` is condition-hidden, and its search needs 2 characters
 *
 * Written loosely and run through `formSchemaSchema.parse` so zod fills in
 * every default — this doubles as a check that the defaults are sane.
 */
export const purchaseRequestPreset = {
  key: 'purchase-request',
  label: 'Purchase request',
  description: 'Procurement flow — remote catalogue cascade, line items, and rules that appear as the total grows.',
  create: (): FormSchema =>
    formSchemaSchema.parse({
      title: 'Purchase request',
      description:
        'Raise a request against the live catalogue. Every field below is described by the JSON in the JSON tab.',
      layout: 'vertical',
      size: 'middle',
      gutter: 16,
      submitText: 'Submit request',
      showReset: true,
      fields: [
        {
          id: 'pr_heading',
          type: 'title',
          name: 'headingRequest',
          label: 'Request details',
          props: { level: 4 },
        },
        {
          id: 'pr_number',
          type: 'input',
          name: 'prNumber',
          label: 'Reference',
          span: 8,
          defaultValue: 'PR-2041',
          disabled: true,
          tooltip: 'Generated when the request is created.',
        },
        {
          id: 'pr_cost_centre',
          type: 'input',
          name: 'costCentre',
          label: 'Cost centre',
          span: 8,
          placeholder: 'FI-204',
          props: { maxLength: 6 },
          rules: [
            { kind: 'required' },
            {
              kind: 'pattern',
              value: '^[A-Z]{2}-\\d{3}$',
              message: 'Two letters, a dash, three digits — e.g. FI-204',
            },
          ],
        },
        {
          id: 'pr_need_by',
          type: 'date',
          name: 'needBy',
          label: 'Needed by',
          span: 8,
          placeholder: 'Select a date',
          props: { picker: 'date' },
          rules: [{ kind: 'required' }],
        },
        {
          id: 'pr_department',
          type: 'radio',
          name: 'department',
          label: 'Department',
          span: 24,
          props: { button: true },
          defaultValue: 'engineering',
          options: [
            { label: 'Engineering', value: 'engineering' },
            { label: 'Operations', value: 'operations' },
            { label: 'Facilities', value: 'facilities' },
            { label: 'Marketing', value: 'marketing' },
          ],
          rules: [{ kind: 'required' }],
        },
        {
          // The single request fired when the Preview mounts.
          id: 'pr_category',
          type: 'select',
          name: 'category',
          label: 'Catalogue category',
          span: 12,
          placeholder: 'Choose a category',
          props: { showSearch: true },
          rules: [{ kind: 'required' }],
          dataSource: {
            url: 'https://dummyjson.com/products/categories',
            dataPath: '',
            labelKey: 'name',
            valueKey: 'slug',
          },
        },
        {
          id: 'pr_priority',
          type: 'select',
          name: 'priority',
          label: 'Priority',
          span: 12,
          placeholder: 'Choose a priority',
          defaultValue: 'standard',
          extra: 'High and Critical need a written justification.',
          options: [
            { label: 'Standard', value: 'standard' },
            { label: 'High', value: 'high' },
            { label: 'Critical', value: 'critical' },
          ],
          rules: [{ kind: 'required' }],
        },
        {
          // `in` accepts a comma-separated string as well as an array.
          id: 'pr_justification',
          type: 'textarea',
          name: 'justification',
          label: 'Justification',
          span: 24,
          placeholder: 'Why can this not wait for the next cycle?',
          props: { rows: 3, maxLength: 400, showCount: true },
          rules: [
            { kind: 'required', message: 'Explain the urgency' },
            { kind: 'min', value: 30, message: 'At least 30 characters' },
          ],
          condition: {
            logic: 'and',
            conditions: [{ field: 'priority', operator: 'in', value: 'high,critical' }],
          },
        },
        {
          // A top-level card is the only container that may hold another one.
          id: 'pr_card_items',
          type: 'card',
          name: 'cardItems',
          label: 'Line items',
          span: 24,
          extra: 'Pick a category first',
          props: { size: 'medium', variant: 'outlined' },
          children: [
            {
              id: 'pr_list',
              type: 'list',
              name: 'lineItems',
              label: 'Items',
              span: 24,
              listConfig: { addText: 'Add line item', minItems: 0, maxItems: 10 },
              children: [
                {
                  // The row has no `category` of its own, so the dependency
                  // falls back to the form-level one.
                  id: 'pr_product',
                  type: 'select',
                  name: 'product',
                  label: 'Product',
                  span: 10,
                  placeholder: 'Choose a product',
                  props: { showSearch: true },
                  rules: [{ kind: 'required' }],
                  dataSource: {
                    url: 'https://dummyjson.com/products/category/{{category}}',
                    dataPath: 'products',
                    labelKey: 'title',
                    valueKey: 'id',
                  },
                },
                {
                  id: 'pr_quantity',
                  type: 'number',
                  name: 'quantity',
                  label: 'Qty',
                  span: 4,
                  defaultValue: 1,
                  props: { min: 1, max: 999, step: 1 },
                  rules: [
                    { kind: 'required' },
                    { kind: 'type', value: 'integer', message: 'Whole units only' },
                  ],
                },
                {
                  id: 'pr_unit_price',
                  type: 'number',
                  name: 'unitPrice',
                  label: 'Unit price',
                  span: 5,
                  placeholder: '0.00',
                  props: { min: 0, step: 0.5, precision: 2 },
                  rules: [{ kind: 'required' }],
                },
                {
                  id: 'pr_tax',
                  type: 'checkbox',
                  name: 'taxIncluded',
                  label: 'Tax',
                  span: 5,
                  defaultValue: false,
                  props: { text: 'Tax incl.' },
                },
                {
                  // Row-local: reacts to THIS row's quantity, not another row's.
                  id: 'pr_bulk_note',
                  type: 'textarea',
                  name: 'bulkNote',
                  label: 'Bulk order note',
                  span: 24,
                  placeholder: 'Over 100 units — confirm storage and lead time',
                  props: { rows: 2 },
                  rules: [{ kind: 'required', message: 'Explain the bulk order' }],
                  condition: {
                    logic: 'and',
                    conditions: [{ field: 'quantity', operator: 'gt', value: 100 }],
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'pr_card_delivery',
          type: 'card',
          name: 'cardDelivery',
          label: 'Delivery',
          span: 24,
          props: { size: 'small', variant: 'outlined' },
          children: [
            {
              id: 'pr_group_where',
              type: 'group',
              name: 'groupWhere',
              label: 'Destination',
              children: [
                {
                  id: 'pr_deliver_to',
                  type: 'radio',
                  name: 'deliverTo',
                  label: 'Deliver to',
                  span: 12,
                  defaultValue: 'office',
                  options: [
                    { label: 'Office HQ', value: 'office' },
                    { label: 'Site address', value: 'site' },
                  ],
                  rules: [{ kind: 'required' }],
                },
                {
                  id: 'pr_flexibility',
                  type: 'slider',
                  name: 'deliveryFlexibility',
                  label: 'Acceptable delay (days)',
                  span: 12,
                  defaultValue: 5,
                  props: { min: 0, max: 30, step: 5 },
                },
                {
                  id: 'pr_site_address',
                  type: 'textarea',
                  name: 'siteAddress',
                  label: 'Site address',
                  span: 12,
                  props: { rows: 2 },
                  rules: [{ kind: 'required' }],
                  condition: {
                    logic: 'and',
                    conditions: [{ field: 'deliverTo', operator: 'eq', value: 'site' }],
                  },
                },
                {
                  id: 'pr_window',
                  type: 'dateRange',
                  name: 'deliveryWindow',
                  label: 'Delivery window',
                  span: 12,
                },
              ],
            },
            {
              id: 'pr_certs',
              type: 'checkboxGroup',
              name: 'certifications',
              label: 'Required certifications',
              span: 24,
              options: [
                { label: 'ISO 9001', value: 'iso9001' },
                { label: 'RoHS', value: 'rohs' },
                { label: 'REACH', value: 'reach' },
                { label: 'FSC', value: 'fsc' },
              ],
            },
          ],
        },
        { id: 'pr_divider', type: 'divider', name: 'dividerApproval', label: 'Approval' },
        {
          // `max` on a number means magnitude, not length.
          id: 'pr_total',
          type: 'number',
          name: 'estimatedTotal',
          label: 'Estimated total',
          span: 8,
          placeholder: '0.00',
          extra: 'Over 5,000 needs a budget owner and two quotes.',
          props: { min: 0, step: 100, precision: 2 },
          rules: [
            { kind: 'required' },
            { kind: 'max', value: 250000, message: 'Above 250,000 use a capital request' },
          ],
        },
        {
          id: 'pr_budget_owner',
          type: 'select',
          name: 'budgetOwner',
          label: 'Budget owner',
          span: 16,
          placeholder: 'Type at least 2 characters',
          rules: [{ kind: 'required' }],
          condition: {
            logic: 'and',
            conditions: [{ field: 'estimatedTotal', operator: 'gt', value: 5000 }],
          },
          dataSource: {
            url: 'https://dummyjson.com/users/search',
            dataPath: 'users',
            labelKey: 'email',
            valueKey: 'id',
            // Never 0: an empty term at mount would fire an unfiltered request.
            search: { param: 'q', debounceMs: 300, minChars: 2 },
          },
        },
        {
          // `min` on an upload means item count, not magnitude or length.
          id: 'pr_quotes',
          type: 'upload',
          name: 'quotes',
          label: 'Competing quotes',
          span: 24,
          props: { buttonText: 'Attach quote', multiple: true, maxCount: 5 },
          rules: [
            { kind: 'required', message: 'Two quotes are required above 5,000' },
            { kind: 'min', value: 2, message: 'Attach at least two competing quotes' },
          ],
          condition: {
            logic: 'and',
            conditions: [{ field: 'estimatedTotal', operator: 'gt', value: 5000 }],
          },
        },
        {
          id: 'pr_notify',
          type: 'switch',
          name: 'notifyFinance',
          label: 'Notify finance',
          span: 12,
          defaultValue: true,
        },
        {
          // No `defaultValue` on purpose: antd treats `false` as a present
          // value, so a required rule only fires while this is undefined.
          id: 'pr_terms',
          type: 'checkbox',
          name: 'terms',
          label: 'Confirmation',
          span: 12,
          props: { text: 'I confirm the budget is available' },
          rules: [{ kind: 'required', message: 'Confirm the budget' }],
        },
        {
          // Hidden, but still reaches the payload.
          id: 'pr_source',
          type: 'input',
          name: 'requestSource',
          label: 'Source',
          span: 24,
          hidden: true,
          defaultValue: 'web-generator',
        },
      ],
    }),
};
