import type { WorkflowSchema } from '../workflow';
import { workflowSchemaSchema } from '../workflow';

/**
 * Demo workflow documents, offered by the Sample button in workflow mode. Same
 * shape as the form presets in `index.ts` and the table presets in `tables.ts`.
 */
export interface WorkflowSamplePreset {
  key: string;
  label: string;
  description: string;
  create: () => WorkflowSchema;
}

/**
 * Canvas layout, so the graph reads as columns and rows. Row 0 is the main
 * line and the base leaves room for a row above it — nothing may land at a
 * negative coordinate, which would put it outside the scrollable stage.
 */
const COL = 288;
const ROW = 192;
const at = (col: number, row: number) => ({ x: 48 + col * COL, y: 240 + row * ROW });

/**
 * Flagship demo: an expense claim that routes on how much money is involved.
 *
 * Exercises every node kind, `lt` / `gt` / `eq`, priority ordering, a fallback
 * branch, two paths converging on one `end`, an approval outcome feeding a
 * later condition, and one deliberate cycle — finance asking for more
 * information sends the run back to the first form.
 *
 * Written loosely and run through `workflowSchemaSchema.parse` so zod fills in
 * every default, which doubles as a check that the defaults are sane.
 */
export const expenseClaimPreset = {
  key: 'expense-claim',
  label: 'Expense claim',
  description:
    'Routes on the amount, asks the right approver, and loops back when finance wants more detail.',
  create: (): WorkflowSchema =>
    workflowSchemaSchema.parse({
      title: 'Expense claim',
      description:
        'Every branch below is an ordinary condition — the same editor a form field uses for visibility.',
      nodes: [
        { id: 'wf_start', kind: 'start', label: 'Claim raised', ...at(0, 0) },

        {
          id: 'wf_details',
          kind: 'form',
          label: 'Claim details',
          description: 'What was spent, and on what.',
          ...at(1, 0),
          form: {
            title: 'Claim details',
            submitText: 'Continue',
            showReset: false,
            fields: [
              {
                id: 'ec_amount',
                type: 'number',
                name: 'amount',
                label: 'Amount',
                span: 12,
                placeholder: '0.00',
                props: { prefix: '£', precision: 2, min: 0 },
                rules: [{ kind: 'required' }, { kind: 'min', value: 1 }],
              },
              {
                id: 'ec_category',
                type: 'select',
                name: 'category',
                label: 'Category',
                span: 12,
                placeholder: 'Choose a category',
                options: [
                  { label: 'Travel', value: 'travel' },
                  { label: 'Software', value: 'software' },
                  { label: 'Equipment', value: 'equipment' },
                  { label: 'Client entertainment', value: 'entertainment' },
                ],
                rules: [{ kind: 'required' }],
              },
              {
                id: 'ec_spent_on',
                type: 'date',
                name: 'spentOn',
                label: 'Date of spend',
                span: 12,
                placeholder: 'Select a date',
                rules: [{ kind: 'required' }],
              },
              {
                id: 'ec_receipt',
                type: 'upload',
                name: 'receipt',
                label: 'Receipt',
                span: 12,
                extra: 'Required over £250.',
              },
              {
                id: 'ec_note',
                type: 'textarea',
                name: 'note',
                label: 'What was it for?',
                placeholder: 'One line is plenty',
                props: { rows: 3, maxLength: 400, showCount: true },
              },
            ],
          },
        },

        {
          id: 'wf_route',
          kind: 'decision',
          label: 'Route by amount',
          description: 'Small claims pay themselves; large ones need finance.',
          ...at(2, 0),
        },

        {
          id: 'wf_auto',
          kind: 'action',
          label: 'Auto-approve',
          description: 'Under the threshold — no human in the loop.',
          ...at(3, -1),
          action: { id: 'expense.autoApprove', label: 'Auto-approve the claim' },
        },

        {
          id: 'wf_manager',
          kind: 'approval',
          label: 'Line manager',
          description: 'The everyday path.',
          name: 'managerDecision',
          ...at(3, 0),
          outcomes: [
            { id: 'approve', label: 'Approve' },
            { id: 'reject', label: 'Reject', danger: true },
          ],
        },

        {
          id: 'wf_finance_form',
          kind: 'form',
          label: 'Finance questions',
          description: 'Extra detail the finance team always asks for.',
          ...at(3, 1),
          form: {
            title: 'Finance questions',
            submitText: 'Send to finance',
            showReset: false,
            fields: [
              {
                id: 'ec_budget_code',
                type: 'input',
                name: 'budgetCode',
                label: 'Budget code',
                span: 12,
                placeholder: 'FI-204',
                rules: [{ kind: 'required' }],
              },
              {
                id: 'ec_preapproved',
                type: 'radio',
                name: 'preApproved',
                label: 'Was this pre-approved?',
                span: 12,
                options: [
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ],
                rules: [{ kind: 'required' }],
              },
              {
                id: 'ec_justification',
                type: 'textarea',
                name: 'justification',
                label: 'Justification',
                placeholder: 'Why could this not wait for the next cycle?',
                props: { rows: 4 },
                rules: [{ kind: 'required' }, { kind: 'min', value: 20 }],
              },
            ],
          },
        },

        {
          id: 'wf_finance',
          kind: 'approval',
          label: 'Finance director',
          description: 'Can send it back for more detail.',
          name: 'financeDecision',
          ...at(4, 1),
          outcomes: [
            { id: 'approve', label: 'Approve' },
            { id: 'moreInfo', label: 'Need more info' },
            { id: 'reject', label: 'Reject', danger: true },
          ],
        },

        {
          id: 'wf_pay',
          kind: 'action',
          label: 'Pay out',
          description: 'Hand off to payroll.',
          ...at(4, 0),
          action: { id: 'expense.payOut', label: 'Send to payroll', params: { run: 'next' } },
        },

        { id: 'wf_paid', kind: 'end', label: 'Reimbursed', ...at(5, -1) },
        { id: 'wf_rejected', kind: 'end', label: 'Rejected', ...at(5, 1) },
      ],

      edges: [
        { id: 'e_start', from: 'wf_start', to: 'wf_details' },
        { id: 'e_details', from: 'wf_details', to: 'wf_route' },

        {
          id: 'e_small',
          from: 'wf_route',
          to: 'wf_auto',
          label: 'Under £250',
          priority: 0,
          condition: { logic: 'and', conditions: [{ field: 'amount', operator: 'lt', value: 250 }] },
        },
        {
          id: 'e_large',
          from: 'wf_route',
          to: 'wf_finance_form',
          label: 'Over £5,000',
          priority: 1,
          condition: { logic: 'and', conditions: [{ field: 'amount', operator: 'gt', value: 5000 }] },
        },
        { id: 'e_normal', from: 'wf_route', to: 'wf_manager', label: 'Everything else', isDefault: true },

        { id: 'e_auto_paid', from: 'wf_auto', to: 'wf_paid' },

        {
          id: 'e_mgr_yes',
          from: 'wf_manager',
          to: 'wf_pay',
          label: 'Approved',
          priority: 0,
          condition: {
            logic: 'and',
            conditions: [{ field: 'managerDecision', operator: 'eq', value: 'approve' }],
          },
        },
        { id: 'e_mgr_no', from: 'wf_manager', to: 'wf_rejected', label: 'Otherwise', isDefault: true },

        { id: 'e_fin_form', from: 'wf_finance_form', to: 'wf_finance' },

        {
          id: 'e_fin_yes',
          from: 'wf_finance',
          to: 'wf_pay',
          label: 'Approved',
          priority: 0,
          condition: {
            logic: 'and',
            conditions: [{ field: 'financeDecision', operator: 'eq', value: 'approve' }],
          },
        },
        {
          id: 'e_fin_back',
          from: 'wf_finance',
          to: 'wf_details',
          label: 'Needs more info',
          priority: 1,
          condition: {
            logic: 'and',
            conditions: [{ field: 'financeDecision', operator: 'eq', value: 'moreInfo' }],
          },
        },
        { id: 'e_fin_no', from: 'wf_finance', to: 'wf_rejected', label: 'Otherwise', isDefault: true },

        { id: 'e_pay_paid', from: 'wf_pay', to: 'wf_paid' },
      ],
    }),
};

/**
 * Smallest thing that still branches — the one to read first, and the one to
 * copy when starting a workflow of your own.
 */
export const supportTriagePreset = {
  key: 'support-triage',
  label: 'Support triage',
  description: 'Two outcomes on one question — the minimum a branch needs.',
  create: (): WorkflowSchema =>
    workflowSchemaSchema.parse({
      title: 'Support triage',
      description: 'One form, one condition, two endings.',
      nodes: [
        { id: 'tr_start', kind: 'start', label: 'Ticket opened', ...at(0, 0) },
        {
          id: 'tr_form',
          kind: 'form',
          label: 'Describe the problem',
          ...at(1, 0),
          form: {
            submitText: 'Send',
            showReset: false,
            fields: [
              {
                id: 'tr_severity',
                type: 'radio',
                name: 'severity',
                label: 'How bad is it?',
                options: [
                  { label: 'Everything is down', value: 'critical' },
                  { label: 'Something is broken', value: 'high' },
                  { label: 'A question', value: 'low' },
                ],
                defaultValue: 'low',
                rules: [{ kind: 'required' }],
              },
              {
                id: 'tr_summary',
                type: 'textarea',
                name: 'summary',
                label: 'What happened?',
                props: { rows: 3 },
                rules: [{ kind: 'required' }],
              },
            ],
          },
        },
        {
          id: 'tr_page',
          kind: 'action',
          label: 'Page the on-call engineer',
          ...at(2, -1),
          action: { id: 'support.page', label: 'Page on-call' },
        },
        { id: 'tr_queue', kind: 'end', label: 'Queued for the next working day', ...at(2, 1) },
        { id: 'tr_open', kind: 'end', label: 'Incident opened', ...at(3, -1) },
      ],
      edges: [
        { id: 'te_start', from: 'tr_start', to: 'tr_form' },
        {
          id: 'te_urgent',
          from: 'tr_form',
          to: 'tr_page',
          label: 'Urgent',
          priority: 0,
          condition: {
            logic: 'or',
            conditions: [
              { field: 'severity', operator: 'eq', value: 'critical' },
              { field: 'severity', operator: 'eq', value: 'high' },
            ],
          },
        },
        { id: 'te_rest', from: 'tr_form', to: 'tr_queue', label: 'Otherwise', isDefault: true },
        { id: 'te_open', from: 'tr_page', to: 'tr_open' },
      ],
    }),
};

export const WORKFLOW_SAMPLE_PRESETS: WorkflowSamplePreset[] = [
  expenseClaimPreset,
  supportTriagePreset,
];

/** What a plain click on the Sample button loads in workflow mode. */
export const DEFAULT_WORKFLOW_PRESET = expenseClaimPreset;
