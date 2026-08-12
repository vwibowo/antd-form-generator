# Writing a document by hand

Reference for producing a valid document as JSON, without the drag-and-drop.
Aimed at someone — or something — turning a stated requirement into a file that
can be imported straight into the app.

**Check your work.** The rules below are enforced by a real verifier:

```bash
pnpm validate path/to/document.json
```

It exits non-zero on an error, prints warnings without failing, and every check
it runs is the same code the app runs. Write the file, validate, fix, repeat.
Do not skip this — most of the ways to be wrong parse cleanly.

The tables here are generated from the registries by `pnpm gen:schema-doc`, so
they cannot drift from the code. The prose is hand-written.

---

## The three documents

Every document has a `kind`, which is how it is told apart on import.

| `kind` | What it is |
| --- | --- |
| `screen` | A thing that asks, tells, or both. Controls and display blocks in one tree. |
| `table` | A data table with its own source, paging and selection. Embeds into a screen as a node. |
| `workflow` | Steps and branches. Each interactive step holds a whole screen. |

A document with **no `kind` at all** is a legacy form and still imports —
it is migrated to a `screen`. Do not write new documents that way.

---

## Screens

```jsonc
{
  "kind": "screen",
  "title": "Expense claim",
  "description": "Optional. Takes {{tokens}} like any other text.",
  "layout": "vertical",        // horizontal | vertical | inline
  "size": "middle",
  "colon": true,
  "gutter": 16,
  "maxWidth": 720,             // optional; omit for full width
  "submitText": "Submit",
  "showReset": true,
  "nodes": []
}
```

Every node shares five keys, then carries whichever payload keys its type uses:

```jsonc
{
  "id": "n_email",             // unique within the document; never in the payload
  "type": "input",
  "span": 12,                  // 1..24 grid width. Full width below `sm`
  "hidden": false,
  "condition": { },            // optional, see Conditions
  "props": { }                 // per-type antd options
}
```

`id` is yours to choose. Anything unique and readable works; the builder
generates `type_8hexchars` but nothing depends on that.

### Node types

<!-- generated:node-types -->
| Type | Category | Collects a value? | Content keys |
| --- | --- | --- | --- |
| `input` | Basic | yes | `name`, `label` |
| `textarea` | Basic | yes | `name`, `label` |
| `password` | Basic | yes | `name`, `label` |
| `number` | Basic | yes | `name`, `label` |
| `otp` | Basic | yes | `name`, `label` |
| `autoComplete` | Basic | yes | `name`, `label` |
| `mentions` | Basic | yes | `name`, `label` |
| `select` | Choice | yes | `name`, `label` |
| `segmented` | Choice | yes | `name`, `label` |
| `cascader` | Choice | yes | `name`, `label` |
| `treeSelect` | Choice | yes | `name`, `label` |
| `transfer` | Choice | yes | `name`, `label` |
| `radio` | Choice | yes | `name`, `label` |
| `checkboxGroup` | Choice | yes | `name`, `label` |
| `checkbox` | Choice | yes | `name`, `label` |
| `switch` | Choice | yes | `name`, `label` |
| `date` | Date & time | yes | `name`, `label` |
| `dateRange` | Date & time | yes | `name`, `label` |
| `time` | Date & time | yes | `name`, `label` |
| `timeRange` | Date & time | yes | `name`, `label` |
| `slider` | Advanced | yes | `name`, `label` |
| `rate` | Advanced | yes | `name`, `label` |
| `colorPicker` | Advanced | yes | `name`, `label` |
| `upload` | Advanced | yes | `name`, `label` |
| `heading` | Content | no | `text` |
| `text` | Content | no | `text` |
| `image` | Content | no | `src`, `alt` |
| `alert` | Content | no | `text` |
| `dataList` | Data | no | `items[]` |
| `summary` | Data | no | `summarySource` |
| `table` | Data | no | `table` |
| `divider` | Layout | no | `label` (inline caption) |
| `group` | Layout | no | `label`, `children[]` |
| `card` | Layout | no | `label`, `children[]` |
| `list` | Layout | yes | `name`, `label`, `children[]` |
| `tabs` | Layout | no | `label`, `children[]` |
| `spacer` | Layout | no | `props.height` |
| `actions` | Actions | no | `actions[]` |
| `custom` | Custom | yes | `name`, `label`, `props.component` |
<!-- /generated:node-types -->

### What goes wrong

These are the mistakes that **parse cleanly and still break**, in rough order of
how often they happen.

**`label` vs `text`.** A control is titled by `label`. A `heading`, `text` or
`alert` carries its content in `text`. A `divider` uses `label` as its inline
caption. Getting this wrong renders an empty node with no error.

**A display node must not have a `name`.** `name` is the payload key, and only
nodes whose "Collects a value?" column says yes own one. A `name` on a heading is
inert; the verifier does not complain, but it means nothing.

**Every collecting node needs a `name`.** Without one it submits under `""` and
collides with every other unnamed node. `missing-name`, an error.

**Nesting is capped.** `root > tabs > card > list` and no deeper. A `tabs` node
holds **only `card` children** — each card is one tab, and the card's `label` is
the tab title. `group` and `list` hold plain nodes only. `illegal-nesting`, an
error.

**Buttons replace the submit row.** A screen containing an `actions` node uses
those buttons and the built-in submit row is suppressed. A screen with no buttons
that collects something gets the row. Never author both expecting both.

**A tab's fields still submit when the tab is closed.** Panes stay mounted on
purpose. Do not "fix" this by splitting a form across screens to avoid it.

**`summarySource` names a workflow node id.** Not a screen node id. It only
resolves inside a workflow; on a standalone screen a `summary` renders nothing.
`missing-summary-source`, a warning.

### Validation rules

On any collecting node, as `rules: []`:

```jsonc
{ "kind": "required", "message": "Optional override" }
{ "kind": "min", "value": 8 }        // length for text, magnitude for numbers,
{ "kind": "max", "value": 120 }      // item count for multi-select and upload
{ "kind": "len", "value": 4 }
{ "kind": "pattern", "value": "^[A-Z]{3}-\\d{3}$" }
{ "kind": "type", "value": "email" } // email | url | number | integer
```

Leave `message` off and antd's own wording is used.

### Conditions

Any node, control or display, can carry one. Same shape everywhere in the
product — screens and workflow branches share it.

```jsonc
"condition": {
  "logic": "and",              // and | or
  "conditions": [
    { "field": "speed", "operator": "eq", "value": "express" }
  ]
}
```

Operators: <!-- generated:condition-operators -->
`eq` · `neq` · `in` · `notIn` · `gt` · `lt` · `contains` · `empty` · `notEmpty`
<!-- /generated:condition-operators -->

`empty` and `notEmpty` ignore `value`. A failed condition **unmounts** the node,
so a hidden control's value leaves the payload rather than lingering.

### `{{token}}` text

`heading`, `text`, `alert`, an `image`'s `src`, and a `dataList` row's `value`
all substitute payload keys:

```jsonc
{ "id": "n_hi", "type": "text", "text": "Claiming for {{merchant}}." }
```

Inside a screen that collects values these read **live form state**, so a summary
updates as the reader types. A missing key renders as nothing, not as the raw
token.

---

## Workflows

```jsonc
{
  "kind": "workflow",
  "title": "Expense claim",
  "nodes": [],
  "edges": [],
  "edgeStyle": "curve"
}
```

### Node kinds

<!-- generated:workflow-kinds -->
| Kind | What it does | Holds a screen? |
| --- | --- | --- |
| `start` | Where every run begins | no |
| `screen` | Asks, tells, or both — and offers a way onward | yes |
| `decision` | Routes without asking anything | no |
| `action` | Asks the host app to do something | no |
| `approval` | Waits for a decision, then branches on it | no |
| `end` | The run finishes here | no |
<!-- /generated:workflow-kinds -->

A `screen` node holds a whole screen document under `screen`, and `x`/`y` place
its card on the canvas — pick anything sensible, roughly 288 apart horizontally
and 192 vertically, or run Arrange in the app afterwards.

```jsonc
{
  "id": "wf_details",
  "kind": "screen",
  "label": "Claim details",
  "name": "detailsChoice",     // the key its buttons write to
  "x": 48, "y": 48,
  "screen": { "kind": "screen", "nodes": [] }
}
```

### Edges

```jsonc
{
  "id": "e_large",
  "from": "wf_details",
  "to": "wf_finance",
  "label": "Over 500",
  "priority": 1,               // lower is tried first
  "isDefault": false,          // the fallback; beats any priority
  "condition": { "logic": "and", "conditions": [
    { "field": "amount", "operator": "gt", "value": 500 } ] }
}
```

Leaving a step: conditional edges are tried in `priority` order, **first match
wins**. If none match, the `isDefault` edge is taken. If there is no default
either, **the run stops** — so give every branching step a default.

### The payload

One flat object. A `screen` step contributes its whole submitted payload, plus
`{ [node.name]: actionId }` when a button was pressed. An `approval` contributes
`{ [node.name]: outcomeId }`. That is why a branch names a field exactly as the
screen does, and why a button and an approval outcome are tested the same way.

Two steps declaring the same field name collide and the later wins —
`duplicate-name`, a warning.

Fields inside a `list` are **not** addressable from a branch: a condition
resolves a name as a single path segment.

### What the verifier checks

`no-start` · `multiple-start` · `no-end` · `dead-end` · `unreachable` ·
`dangling-edge` · `shadowed-edge` · `no-default` · `multiple-default` ·
`duplicate-name` · `empty-screen` · `no-way-onward` · `no-outcomes` ·
`missing-summary-source` · `cycle`

Cycles are reported, not forbidden — "send it back for more detail" is the point
of having them.

---

## Worked example: a screen

A screen that asks and tells, with buttons instead of a submit row.

```json
{
  "kind": "screen",
  "title": "Confirm your order",
  "maxWidth": 720,
  "nodes": [
    { "id": "n_head", "type": "heading", "text": "Delivery", "props": { "level": 4 } },
    { "id": "n_to", "type": "input", "name": "recipient", "label": "Recipient",
      "span": 12, "rules": [{ "kind": "required" }] },
    { "id": "n_pc", "type": "input", "name": "postcode", "label": "Postcode",
      "span": 12, "rules": [{ "kind": "required" }] },
    { "id": "n_sum", "type": "dataList", "props": { "columns": 2 },
      "items": [
        { "label": "Recipient", "value": "{{recipient}}" },
        { "label": "Postcode", "value": "{{postcode}}" }
      ] },
    { "id": "n_go", "type": "actions", "actions": [
      { "id": "confirm", "label": "Place order", "variant": "primary" },
      { "id": "later", "label": "Save for later", "variant": "default" }
    ] }
  ]
}
```

```bash
pnpm validate order.json    # ✓ order.json (screen)
```

## Worked example: a workflow

Two steps and a branch on what was collected.

```json
{
  "kind": "workflow",
  "title": "Expense claim",
  "nodes": [
    { "id": "wf_start", "kind": "start", "label": "Start", "x": 48, "y": 48 },
    { "id": "wf_details", "kind": "screen", "label": "Claim details",
      "name": "detailsChoice", "x": 336, "y": 48,
      "screen": { "kind": "screen", "submitText": "Continue", "nodes": [
        { "id": "d_what", "type": "input", "name": "merchant", "label": "Merchant",
          "rules": [{ "kind": "required" }] },
        { "id": "d_amt", "type": "number", "name": "amount", "label": "Amount",
          "rules": [{ "kind": "required" }] }
      ] } },
    { "id": "wf_approve", "kind": "approval", "label": "Manager approval",
      "name": "approval", "x": 624, "y": 48,
      "outcomes": [
        { "id": "approve", "label": "Approve" },
        { "id": "reject", "label": "Reject", "danger": true }
      ] },
    { "id": "wf_paid", "kind": "end", "label": "Reimbursed", "x": 912, "y": 48 },
    { "id": "wf_no", "kind": "end", "label": "Declined", "x": 912, "y": 240 }
  ],
  "edges": [
    { "id": "e1", "from": "wf_start", "to": "wf_details" },
    { "id": "e2", "from": "wf_details", "to": "wf_approve" },
    { "id": "e3", "from": "wf_approve", "to": "wf_paid", "label": "Approved",
      "priority": 0,
      "condition": { "logic": "and", "conditions": [
        { "field": "approval", "operator": "eq", "value": "approve" } ] } },
    { "id": "e4", "from": "wf_approve", "to": "wf_no", "isDefault": true,
      "label": "Otherwise" }
  ]
}
```

```bash
pnpm validate claim.json    # ✓ claim.json (workflow)
```

Note `e4`: the approval branches on a condition and has a **default**, so a run
can never stick. Omitting it is the single most common way to author a workflow
that stops halfway.

---

## Getting it into the app

`pnpm dev`, then **Import** in the header. The file's own `kind` selects the
mode, so there is nothing to pick first. The Preview tab runs it for real.
