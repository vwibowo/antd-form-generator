# antd Generator

Build an [Ant Design](https://github.com/ant-design/ant-design) **screen**, **table** or **workflow** in a drag-and-drop UI, get a JSON schema out, and render that JSON back into a working component.

The JSON schema is the contract between the two halves, and the two halves are now two packages. The renderer and the schema live in `packages/form-generator` and import nothing from the builder; the drag-and-drop, the stores and the panes are `apps/example`, one consumer of that library among however many you write. See [Layout](#layout).

The **Screen / Table / Workflow** switch in the header chooses which document the tabs are editing. They are separate documents with separate storage, undo stacks and export files — see [Table documents](#table-documents) and [Workflow documents](#workflow-documents).

A **screen** both asks and tells. It holds form controls, display blocks, or any mixture: a heading, a paragraph, three fields, a callout and a row of buttons is one screen, not one of each. Forms and pages used to be separate documents and could not be combined; if you have saved files or a browser profile from that era, see [Screens were once forms and pages](#screens-were-once-forms-and-pages).

## Running it

```bash
pnpm install
```

```bash
pnpm dev
```

Both run from the repo root — this is a pnpm workspace, and the root scripts forward to whichever
package needs them.

Then open http://localhost:3000. Click **Sample** in the header for the flagship demo, or use the arrow beside it to pick a preset for whichever document is active. In screen mode:

| Preset | What it shows |
| --- | --- |
| **Purchase request** | A screen that only asks. A procurement flow that grows as you fill it in — a remote catalogue cascade, repeatable line items, and rules that only appear once the total passes 5,000. Opening the Preview fires exactly one request; every other one is caused by something you did. |
| **Review and confirm** | A screen that asks *and* tells — the thing separate form and page documents made impossible. Controls and display blocks in one grid, a data list echoing what you are typing right now, a callout that appears only for the pricier delivery option, and buttons instead of a Submit row. |
| **Account settings** | A long screen split into tabs, with a collapsible section and a repeatable inside one. The reference for how containers nest — every level the rules allow, used once. |
| **Remote data** | Every API response shape the option mapper handles, side by side: a bare array of objects, a bare array of plain strings, a nested `dataPath`, and a dot-path label. Plus cascading, debounced server-side search, and the HTTP error state. |
| **Welcome pack** | A screen that only tells. One of every display node, bound to a payload you type in the Preview tab — no controls at all, so no `<Form>` is rendered around it. |
| **Kitchen sink** | Reference screen. One of every control type, every per-type setting, every validation rule, and all nine condition operators. Horizontal layout with a fixed label column. |

In table mode the same button offers **Inline array** (rows pasted into the document, one column per cell format, with search, a derived Status filter and two bulk actions) and **API list** (dummyjson products, paged *and searched* on the server via `limit`/`skip`/`q`, with selection kept across pages).

In workflow mode it offers **Current account onboarding** (screens that tell and screens that ask, branching on which button was pressed), **Expense claim** (routes on the amount, asks the right approver, and loops back when finance wants more detail — every node kind, priority ordering, a fallback branch and a deliberate cycle) and **Support triage** (the smallest thing that still branches: one screen, one condition, two endings).

Between them the presets cover every feature documented below, so they double as a manual regression suite.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 (set `PORT` to override) |
| `pnpm build` | Production bundle into the repo-root `dist/` — tracked on purpose; it is what GitHub Pages serves |
| `pnpm preview` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` in every workspace |
| `pnpm test` | Vitest, once — one run, both packages |
| `pnpm test:watch` | Vitest, watching. A library edit re-runs the app's tests too |
| `pnpm validate <file.json> …` | Check hand-authored documents against the schema rules. Paths are relative to wherever you are |
| `pnpm gen:schema-doc` | Rebuild the generated tables in `packages/form-generator/docs/SCHEMA.md` |
| `pnpm gen:fixtures` | Freeze the sample presets to JSON. Read the header first — it will not reproduce the committed fixtures |

## The tabs

- **Builder** — palette on the left, canvas in the middle, inspector on the right. Drag from the palette onto the canvas, or click a palette entry to append. Drag the handle on a node card to reorder it or move it into a container. The palette has a filter box, because one screen can hold any of 39 node types. In table mode the left pane becomes the data source and column list instead; in workflow mode the canvas is a node graph.
- **Preview** — the schema rendered for real. A screen that collects values is submittable, with the resulting payload beside it; one that only displays gets a payload *editor* beside it instead, since there is nothing to submit and the `{{tokens}}` need something to read. For a table, the table on its own. For a workflow, the flow actually run, step by step.
- **Summary** — a payload rendered as a read-only confirmation page. Screen mode only; a table submits nothing, and a workflow's payload is spread across several screens. See [Summary pages](#summary-pages).
- **JSON** — the schema as text. Edits apply to the builder the moment the JSON is valid; while it is invalid the errors are listed and the builder is left alone.

Each document is saved to its own `localStorage` key as you go, and **Export** / **Import** move it in and out as a `.json` file (`screen-schema.json` / `table-schema.json` / `workflow-schema.json`). Import reads the file's own `kind` and switches the mode to match, so you never have to pick the right one first — including the two kinds that no longer exist, which are migrated on the way in.

## Node types

A screen is a tree of **nodes**. Some collect a value, some only display one, and the difference is
the single thing that makes the merged document coherent — `collectsValue(type)` in
`packages/form-generator/src/schema/screen.ts` decides it, and everything downstream reads that one answer.

| Category | Types | Collects? |
| --- | --- | --- |
| Basic | text, textarea, password, number, one-time code, autocomplete, mentions | yes |
| Choice | select, radio group, checkbox group, checkbox, switch, segmented, cascader, tree select, transfer | yes |
| Date & time | date, date range, time, time range | yes |
| Advanced | slider, rate, colour, upload | yes |
| Layout | divider, spacer, group, card, **tabs**, repeatable | repeatable only |
| Content | heading, paragraph, image, callout | no |
| Data | data list, screen summary, table | no |
| Actions | buttons | no |
| Custom | whatever the host app registers — see [Custom components](#custom-components) | yes |

What `collectsValue` gates:

- whether the inspector offers a **name**, validation rules and a default value
- whether the renderer wraps the node in a `Form.Item`
- whether the node's key appears in `collectPayloadKeys`
- whether the screen needs a `<Form>` around it **at all** — a screen of pure display nodes renders
  a plain `<div>`, so nothing subscribes to form state that does not exist

It deliberately lives in the schema rather than the builder registry, because `packages/form-generator/src/renderer/`
switches on `type` directly and never reads builder metadata.

`group` (a plain fieldset) and `card` (an antd `Card` with a title) are **chrome only** — they
collect nothing themselves, but their children keep top-level names and do not nest in the payload.
`repeatable` is a `Form.List`: it owns its name and its children become an array of objects. A
display node is the other kind of "collects nothing": it has no children to look through either.
Conflating the two is how you silently drop every field inside a card, which is what
`packages/form-generator/src/renderer/payload.test.ts` exists to prevent.

Cards are sections, so a card can hold other containers — including a repeatable. To keep the JSON
legible that is capped at three containers deep: **`root > tabs > card > repeatable`**. `group` and
`repeatable` hold plain nodes only.

**Tabs** section a screen that has grown too long to scroll. A tab strip holds `card` children and
nothing else, because **a tab is a card** — the card's own label titles the tab, and its own props
style the pane. That is what keeps the schema flat: `children` is still one array of nodes, so the
tree walking, the drag and drop and the payload never had to learn a second shape.

Every pane stays mounted, open or not. `Form.Item` carries `preserve={false}`, so a pane antd
unmounted would take its fields' values out of the payload without saying so — you would submit and
silently lose whatever was typed in a tab you had navigated away from. A required field in an
unopened tab still blocks the submit, which is the behaviour you want and the one
`packages/form-generator/src/renderer/payload.test.ts` pins.

The samples are checked against the drop rules too (`packages/form-generator/src/schema/samples/samples.test.ts`): a preset
that describes a tree the builder would refuse to assemble is worse than a broken one, because the
app ships it, renders it, and then cannot reproduce it.

## Screen schema shape

```jsonc
{
  "version": 1,
  "kind": "screen",
  "title": "Conference registration",
  "layout": "vertical",          // horizontal | vertical | inline
  "size": "middle",
  "colon": true,
  "gutter": 16,
  "maxWidth": 720,               // optional; omit for full width
  "submitText": "Register",
  "showReset": true,
  "nodes": [
    {
      "id": "s_email",           // builder identity; never appears in the payload
      "type": "input",
      "name": "email",           // the payload key
      "label": "Email",
      "span": 12,                // 1..24 grid width; full width below the `sm` breakpoint
      "placeholder": "ada@example.com",
      "disabled": false,
      "hidden": false,
      "rules": [
        { "kind": "required" },
        { "kind": "type", "value": "email" }
      ],
      "props": {}                // per-type antd control options
    },
    {
      "id": "s_note",
      "type": "alert",           // a display node: no name, no rules
      "text": "We will email {{email}} to confirm.",
      "span": 24,
      "props": { "tone": "info" }
    }
  ]
}
```

Every node shares the same five keys — `id`, `span`, `hidden`, `condition`, `props` — and then
carries whichever payload keys its type uses. A control has `name`, `label`, `rules`; a display node
has `text`, `src`, `items`, `actions`. A node holding the one it does not use is harmless, the same
way `options` on a divider always was.

**Two ways onward, and only one at a time.** A screen with an `actions` node uses those buttons; the
built-in Submit row is suppressed, so the reader is never offered two ways to do the same thing. A
screen with no buttons that collects something gets the Submit row. Either way the result reaches
the host the same: pressing a button validates the screen first, then hands over the typed values
*and* the button's id together, which is exactly what a workflow branch reads.

**`{{token}}` text** — `heading`, `paragraph`, `callout`, `image` sources and data-list rows all
interpolate payload keys. Inside a screen that collects values these read **live form state**, so a
summary can echo what is being typed. Each one watches only the names it actually mentions rather
than the whole form, so a paragraph naming one field costs one subscription, not a re-render per
keystroke.

**Per-type control options** — `props` is a free-form bag holding the antd props for that field's control. Everything editable lives in `packages/form-generator/src/schema/propSpecs.ts`, which drives the inspector's settings panel; the renderer reads the same keys in `packages/form-generator/src/renderer/controls.tsx`. Adding a new prop means one spec entry and one read.

| Type | `props` keys |
| --- | --- |
| input | `prefix`, `suffix`, `variant`, `size`, `maxLength`, `inputType`, `allowClear`, `readOnly` |
| password | `prefix`, `variant`, `size`, `maxLength`, `visibilityToggle`, `readOnly` |
| textarea | `variant`, `size`, `rows`, `autoSize` + `minRows` / `maxRows`, `maxLength`, `showCount`, `allowClear`, `readOnly` |
| number | `prefix`, `suffix`, `variant`, `size`, `min`, `max`, `step`, `controls`, `keyboard`, `readOnly`, `precision`, `thousandSeparator`, `decimalSeparator`, `stringMode` |
| select | `prefix`, `variant`, `size`, `mode`, `showSearch`, `maxTagCount`, `maxCount`, `placement`, `allowClear`, `readOnly` |
| radio | `button`, `buttonStyle`, `size`, `block` |
| checkbox | `text` |
| switch | `checkedChildren`, `unCheckedChildren`, `size` |
| date | `prefix`, `variant`, `size`, `allowClear`, `picker`, `showTime`, `minDate`, `maxDate`, `readOnly`, `inputReadOnly`, `format`, `valueFormat` |
| dateRange | all of `date`, plus `startPlaceholder`, `endPlaceholder`, `separator`, `order` |
| time | `variant`, `size`, `allowClear`, `use12Hours`, `hourStep`, `minuteStep`, `secondStep`, `readOnly`, `inputReadOnly`, `format`, `valueFormat` |
| slider | `min`, `max`, `step`, `unit`, `dots`, `reverse`, `vertical` |
| rate | `count`, `character`, `allowHalf`, `allowClear` |
| upload | `buttonText`, `listType`, `showUploadList`, `accept`, `maxCount`, `multiple` |
| divider | `titlePlacement`, `variant`, `size`, `plain` |
| card | `size`, `variant`, `collapsible`, `defaultOpen` |
| tabs | `position` (`top` / `start`), `centered` |

Display nodes are not in that table. Their settings are few and per-type, so the inspector edits them
directly in `apps/example/src/builder/inspector/DisplayProps.tsx` rather than through generic prop rows: `heading`
takes a `level`, `callout` a `tone`, `spacer` a `height`, `data list` and `screen summary` a column
count and a border.

**Collapse** is a card, not a type of its own. Set `collapsible` and the card draws as a one-panel
antd `Collapse` whose header is its label; `defaultOpen` decides whether it starts folded. Folding
only hides — the children stay mounted and still submit, so tidying a section away never changes the
payload. The builder canvas always draws it open, because a folded section hides its drop zone.

An absent key means antd's own default, so a field only carries what it deliberately changes. `prefix`, `suffix`, `checkedChildren`, `unCheckedChildren` and `character` are ReactNode props authored as plain text. `readOnly` keeps the value visible *and* submitted (unlike `disabled`); on `select` and the pickers it is emulated — no popup, no typing, no clear button. `thousandSeparator` / `decimalSeparator` are display only: the submitted value stays a plain number, so `min` / `max` rules keep working.

**Date formats** — two independent settings on `date`, `dateRange` and `time`:

```jsonc
"props": {
  "format": "DD/MM/YYYY",       // how the input displays it — any dayjs pattern
  "valueFormat": "YYYY-MM-DD"   // what lands in the submitted JSON
}
```

`valueFormat` accepts a dayjs pattern, `timestamp` (milliseconds), `unix` (seconds), or nothing at all for ISO 8601 — the default, and what the generator emitted before the setting existed. It also decides how the field's `defaultValue` is read back, so an authored default is written in the same format the form submits. A `dateRange` default is an array of two such strings.

**Validation rules** — `required`, `min`, `max`, `len`, `pattern` (a regex source string), and `type` (`email` / `url` / `number` / `integer`). Each takes an optional `message`; leave it off and antd's own default is used. `min` and `max` mean length for text, magnitude for numbers, and item count for multi-select and upload.

**Conditional visibility** — any node, control or display, can carry a `condition`:

```jsonc
"condition": {
  "logic": "and",                 // and | or
  "conditions": [
    { "field": "ticket", "operator": "eq", "value": "other" }
  ]
}
```

Operators: `eq`, `neq`, `in`, `notIn`, `gt`, `lt`, `contains`, `empty`, `notEmpty`. When a condition fails the node is unmounted; for a control its `Form.Item` carries `preserve={false}`, so the value leaves the submitted payload rather than lingering.

On a screen that collects values the condition is evaluated against live form state, so a callout can appear the moment a choice is made. On a screen that only displays, it reads the finished payload it was handed. The two are separate components rather than a branch inside one, because `Form.useWatch` outside a `<Form>` warns and returns nothing.

Inside a repeatable row a condition resolves against that row first, then falls back to the top level — so a row field can react to its own sibling *and* to a screen-level field.

**Remote options** — `select`, `radio`, and `checkboxGroup` can pull their options from an API instead of an inline `options` array. Add a `dataSource` block (the Options section of the inspector has a Static | Remote toggle):

```jsonc
"dataSource": {
  "kind": "remote",
  "url": "https://dummyjson.com/products/category/{{category}}",
  "dataPath": "products",         // dot path to the array; blank = the response itself
  "labelKey": "title",            // dot paths allowed, e.g. "name.common"
  "valueKey": "id",
  "search": {                     // omit for a single fetch filtered client-side
    "param": "q",
    "debounceMs": 300,
    "minChars": 2
  }
}
```

`{{fieldName}}` interpolates another field's live value, which is what makes cascading selects work. The dependent field stays disabled until every `{{...}}` has a value, refetches when one changes, and clears its own selection so a stale choice cannot be submitted. Dependencies resolve row-first then top-level, exactly like conditions, so a cascade works inside a repeatable row.

`search` is honoured by `select` only. It turns on antd's `showSearch` with `filterOption` off — the list *is* the server's answer — and appends the typed term as `?param=`.

Two things to know before pointing it at a real API:

- **Requests run in the browser.** There is no proxy, so the API must send `Access-Control-Allow-Origin`. A blocked read is indistinguishable from being offline and surfaces as "Network or CORS error".
- **Never put a token in the URL.** The schema is saved to `localStorage`, shown in the JSON tab, and included in every export. There is deliberately no headers, auth, or method field for the same reason; requests are GET with `credentials: 'omit'`. If you need authenticated option loading, pass it at runtime from the app embedding `ScreenRenderer`.

The builder canvas never fetches — it shows an inert placeholder while you drag and edit. Live requests happen in the Preview tab.

The **Remote data** sample preset is the live reference for all of this: each field in it reads a differently shaped response, so open its Options panel in the Builder to see how a given API maps onto `dataPath` / `labelKey` / `valueKey`.

## Table documents

Two things that are not forms: an array you already have, and an API that returns a list. Switch the
header to **Table** and the tabs edit a table document instead.

```jsonc
{
  "kind": "table",                 // the discriminator an import reads
  "version": 1,
  "title": "Invoices",
  "rowKey": "id",                  // dot path to a stable id; blank uses the row position
  "source": { "kind": "static", "rows": [ /* … */ ] },
  "columns": [
    {
      "id": "col_a1b2",            // builder identity; never rendered
      "key": "total",              // dot path into a row, e.g. "supplier.name"
      "title": "Amount due",       // the header — this is the rename
      "align": "right",
      "width": 140,
      "sortable": true,
      "hidden": false,
      "format": "number",          // text | number | date | boolean
      "props": { "prefix": "$", "precision": 2, "thousandSeparator": "," }
    }
  ],
  "props": { "bordered": true, "pageSize": 10, "showTotal": true }
}
```

**Columns** are renamed in the inspector (Header), reordered by dragging the handle in the column
list, and hidden with the eye toggle — a hide keeps the column in the document, so it is reversible.
**Detect columns** reads the rows you already have and writes one column per key, descending one
level into nested objects as dotted paths, title-casing the key and guessing the format from the
value. It is the fastest way from "here is my data" to a table.

**A column's `key` is a dot path**, so nested values are addressed directly — and the inspector's
**Field** box lists every path found in the rows already loaded, each with a sample value, rather
than leaving you to type one blind:

```jsonc
// [{ "id": 1, "reviews": { "path": "asdas" }, "tags": [{ "name": "new" }] }]
"key": "reviews.path"     // "asdas"
"key": "tags.0.name"      // "new"      — a numeric segment indexes an array
"key": "reviews"          // the object itself, rendered as JSON
```

The list is capped at four levels and 200 paths, since it runs against whatever an API returned.
Typing still works, so a document written elsewhere can name a path this sample happens not to
contain — the hint under the box then says so, and the cells show an em dash instead of silently
looking empty. Choosing a path sets the field and nothing else: the hint reports what the value
looks like, and you pick the format.

`render` is a function and cannot live in a JSON document, so each column carries a `format` name
plus options instead — the same declarative trick the number and date fields use, and literally the
same helpers (`formatNumber`, `parseDateValue`). A blank or unreadable cell renders an em dash
rather than throwing.

### Selecting, searching, filtering

```jsonc
"search": { "enabled": true, "placeholder": "Search invoices", "columnIds": [], "param": "q" },
"selection": {
  "enabled": true, "type": "checkbox", "preserveAcrossPages": false,
  "actions": [ { "id": "act_void", "label": "Void", "danger": true, "minSelected": 2 } ]
},
"columns": [ { "key": "paid", "title": "Status", "filterable": true } ]
```

**Search** is one box above the table. It matches against the **rendered** text, not the raw value,
so `paid` finds a boolean column showing `Paid` and `1,250` finds a number shown as `$1,250.50` —
what the reader can see is what the box searches. `columnIds` narrows which columns take part;
blank searches every visible one.

**Filters** are the antd header dropdowns, and their values are *derived from the rows in hand*
rather than authored, so the list cannot drift from the data. Labels go through the same cell
formatter as the column, which is why the Status filter offers `Paid` / `Outstanding` rather than
`true` / `false`.

**Selection** is runtime state — a table submits nothing. The renderer owns it and hands it out:

```tsx
<TableRenderer
  schema={schema}
  onSelectionChange={(keys, rows) => …}
  onAction={(actionId, keys, rows) => …}   // a bulk-action button was pressed
/>
```

Bulk actions carry only an id, a label and a `minSelected` threshold; what `act_void` *means*
belongs to the host app. A button stays disabled below its threshold rather than failing after the
callback has already fired. The Preview tab lists the selected keys and the last action, standing in
for a host so the callbacks are visible while you build.

Under **client** paging all three run in the browser. Under **server** paging they become query
parameters — `?q=phone`, and one parameter per filtered column (`filterParam`, defaulting to the
column's own field) — refetching the way page and sort already do, because filtering one page of a
result set you cannot see the rest of would be a lie. Typing is debounced (300ms by default) so a
five-letter search costs one request. One caveat worth knowing: a filter dropdown can only list
values it has seen, which under server paging means the current page.

**Table props** live in the same free-form `props` bag as a field's, described by
`packages/form-generator/src/schema/tablePropSpecs.ts`: `size`, `bordered`, `showHeader`, `sticky`, `tableLayout`, `virtual`,
`scrollX`, `scrollY`, `emptyText`, and the pagination set (`pagination`, `pageSize`,
`pagePlacement`, `showSizeChanger`, `showQuickJumper`, `showTotal`, `simplePagination`). Function and
node props — `rowSelection`, `expandable`, `summary`, `onCell` — are deliberately absent.

### Rows from an API

```jsonc
"source": {
  "kind": "remote",
  "url": "https://dummyjson.com/products",
  "dataPath": "products",          // dot path to the array; blank = the response itself
  "paging": "server",              // client = fetch once and page in the browser
  "pageMode": "offset",            // offset sends rows-to-skip; page sends a page number
  "pageParam": "skip",
  "sizeParam": "limit",
  "pageStart": 1,                  // for `page` mode, whether the first page is 1 or 0
  "totalPath": "total",            // dot path to the row count
  "sortParam": "sortBy",           // blank turns server-side sorting off
  "orderParam": "order", "ascValue": "asc", "descValue": "desc"
}
```

`client` paging fetches once and lets antd page, sort and filter the array. `server` paging sends
the page, size and sort as query parameters and reads the row count from `totalPath`, so every page
change is a fresh request — which is what the **API list** preset demonstrates against dummyjson's
`limit`/`skip`.

The URL takes the same `{{token}}` templating the form's remote options use, resolved against the
document's `params` block (the panel grows an input per token). Same rules, too: GET only, no
headers or auth field, because the document is persisted, shown in the JSON tab and exported.

Under the hood both features share one network layer — `packages/form-generator/src/renderer/remote/useFetchedBody.ts` does
the caching, aborting and error strings for options and rows alike.

## Workflow documents

A form is one page. A workflow is a process: collect these fields, then depending on what was
entered go to this step or that one, get an approval, loop back for more information, finish.

Switch the header to **Workflow** and the canvas becomes a node graph. Drag a step out of the
palette, drag the dot on a card's right edge onto another card to branch, and click a branch to give
it a condition.

### Node kinds

| Kind | What it does |
| --- | --- |
| **start** | Where every run begins. Exactly one per workflow |
| **screen** | Holds a whole embedded screen. "Edit screen" opens the ordinary builder on it |
| **decision** | Asks nothing — evaluates its outgoing branches and passes straight through |
| **action** | Describes something for the host app to do. Intent only: an id, a label, static params |
| **approval** | Waits for an outcome, and stores the chosen one under the node's payload key |
| **end** | The run finishes here |

A `screen` node covers what used to take two kinds. It contributes twice over: the keys its controls
collect, and — when it has buttons — the pressed button's id under the node's own payload key. A step
that asks, a step that tells and offers a choice, and a step that does both are all one kind now.

### Branches

A branch is an edge with a condition, and the condition is the **same** `ConditionGroup` a field's
visibility uses — same nine operators, same editor, same evaluator. There is one set of rules to
learn:

```jsonc
{
  "id": "e_large",
  "from": "wf_route",
  "to": "wf_finance_form",
  "label": "Over £5,000",
  "priority": 1,
  "condition": { "logic": "and", "conditions": [{ "field": "amount", "operator": "gt", "value": 5000 }] }
}
```

Leaving a step, the conditional branches are tried in `priority` order and the **first match wins**.
If none match, the step's `isDefault` branch is taken. If there is no default either, the run stops
and says so — sitting on the current step would be indistinguishable from a hang.

### The payload

Everything collected lands in **one flat object**: each screen node contributes its whole submitted
payload plus, if a button was pressed, `{ [node.name]: actionId }`; an approval contributes
`{ [node.name]: outcomeId }`. That is why a branch names a field exactly as it would inside a screen,
and why a button or an approval outcome can be tested with an ordinary `eq` condition several steps
later — there is one routing mechanism, not three.

The flat shape is a deliberate consequence of the condition evaluator resolving a field name as a
single path segment. Two screen nodes declaring the same name collide and the later one wins — the
builder warns, the way it warns about duplicate names within one screen. For the same reason a field
inside a repeatable section cannot be branched on, and is not offered in the picker.

### Problems

Select nothing and the inspector lists what is wrong with the graph: a missing start, a step with no
way out, an unreachable step, a branch queued behind an unconditional one, a step with several
conditional branches and no fallback. Click a row to jump to it. None of it blocks saving, exporting
or previewing — a document being edited is allowed to be broken on the way to being right.

Cycles are reported, not forbidden. "Finance wants more detail, go back to the first form" is the
point of having them, so the wording is an observation rather than a complaint.

### Running one

The Preview tab runs the flow for real: a progress indicator and the current step on the left, the
accumulated payload and the path taken on the right, with Back and Restart.

The indicator is derived from the graph, not authored. `workflowStages` in `workflowGraph.ts` breaks
the cycles and ranks the remaining steps by longest path — the same two helpers the Arrange button
uses, which is why they live in the schema layer and not the builder. Steps that only route
(`start`, `decision`) get no stage, because nobody experiences them; parallel branches collapse into
one, because "step 3 of 5" counts how far along the reader is, not how many routes the graph has.

A stage already visited is captioned with the step actually taken; one still ahead of a fork is
captioned generically, because the graph cannot say which way the reader will be sent and guessing
would read as a promise. Loops behave: going back makes an earlier stage current again rather than
pushing the total past the end.

Deliberately **not** a screen node. A `steps` block dropped on a screen would have to be maintained
by hand, could not see the run, and could be placed on some screens and forgotten on others. A screen step renders through the ordinary
`ScreenRenderer`, so validation, conditional nodes, live `{{tokens}}` and remote options all behave
exactly as they do in screen mode. Returning to a step already answered brings its earlier answers
back with it.

## Custom components

When a use case outgrows the built-in types, the host app can supply its own control. The schema only ever names it:

```jsonc
{
  "id": "f_colour", "type": "custom", "name": "brandColour", "label": "Brand colour",
  "props": { "component": "colorPicker", "showText": true }
}
```

The component itself is registered in app code and passed to the renderer:

```tsx
import { ScreenRenderer } from '@antd-form-generator/core/renderer/ScreenRenderer';
import type { CustomComponentRegistry } from '@antd-form-generator/core/renderer/custom';

const components: CustomComponentRegistry = {
  colorPicker: {
    label: 'Colour',                       // palette entry + inspector picker
    component: ColorField,                 // gets { value, onChange, disabled, placeholder, node, options }
    icon: <BgColorsOutlined />,
    defaults: { label: 'Brand colour', namePrefix: 'colour' },
    propSpecs: [                           // inspector rows, same shape the built-ins use
      { key: 'showText', label: 'Show the hex value', group: 'Appearance', editor: { kind: 'bool' }, default: false },
    ],
    valueKind: 'array',                    // how min/max rules are read; default 'string'
    valuePropName: 'checked',              // only for controls whose value is not `value`
    serialize: (value, node) => /* -> JSON */,
  },
};

<ScreenRenderer schema={schema} components={components} />
```

`value` and `onChange` are injected by `Form.Item`, exactly as for the antd controls — a component just reads one and calls the other. Anything else it needs comes from `node.props`, and each key it wants editable gets a `propSpecs` entry.

Wrap a subtree in `CustomComponentsProvider` instead of passing the prop, and the builder picks the registry up too: registered components appear in the palette's **Custom** group, and the canvas renders the real component rather than a stand-in. `apps/example/src/App.tsx` does exactly that with the two demos in `apps/example/src/custom/` — a colour picker, and a key/value editor that holds an array while editing and submits an object through its `serialize` hook.

Two things worth knowing:

- **A schema never carries code.** `props.component` is a name, resolved against a registry the app controls. An imported `.json` cannot introduce a component, only ask for one.
- **Unknown names degrade, they do not throw.** A screen exported from an app that registered `signaturePad` and opened somewhere that did not shows a "not registered" notice in that node's place; every other node keeps working, and the inspector flags the missing name rather than silently rewriting it.

## Summary pages

The step between filling a form in and sending it: the same answers as a read-only page, so they can
be checked before they go anywhere.

There is **no summary schema**. The page is derived from the `ScreenSchema` the values came from, and
the traversal mirrors the one in `serialize.ts`, so the page and the payload cannot drift apart:

```tsx
import { SummaryRenderer } from '@antd-form-generator/core/renderer/summary/SummaryRenderer';

<SummaryRenderer schema={schema} values={submitted} columns={2} bordered={false} />
```

| Schema feature | On the page |
| --- | --- |
| `group` / `card` | a section — the card's own frame, or a heading and a rule |
| repeatable | one boxed, numbered block per row |
| `divider` / `heading` | kept; they are the document's structure |
| other display nodes | skipped. A callout telling you what to type has nothing to say once you have |
| `condition` | evaluated against the payload. A field whose condition fails is absent here, exactly as it is absent from the payload |
| `hidden` | skipped. It still submits, but a confirmation page repeats what the user was asked |
| `span` | 24 takes a whole row, anything narrower shares one |
| `password` | masked. A confirmation page is not the place to print a secret |
| `select` / `radio` / checkbox group | the option's **label**, not its stored value |
| dates, numbers | the field's own `format` / `precision` / `prefix` / separators, so a value reads the same as it did in the control |
| a value that was never filled in | a muted em dash |

Custom components get a `summary` hook beside `serialize` — it receives the value as it sits in the
payload and returns whatever should be shown (the colour demo draws its swatch, the key/value demo
lists its pairs). Without one, the page prints what `serialize` produced.

One gap worth naming: a `select` fed by a `dataSource` shows the raw value, because resolving its
label means a request and the summary has no form instance to resolve `{{tokens}}` against.

The **Summary** tab is this renderer with a payload editor beside it — **Load defaults** seeds it
from the schema's own `defaultValue`s, and invalid JSON leaves the last good page on screen rather
than blanking it. The values live in `antd-form-generator:summary-values`; they are sample data for
previewing, not part of either document, so they are never exported.

## Layout

Two pnpm workspaces, and the split is the same line the JSON schema already drew: the library is
what renders a document, the app is what edits one.

```
packages/form-generator/          @antd-form-generator/core — the library
  src/schema/  zod definitions (the single source of truth for shape, TS types, and validation),
               nodeBase.ts  the keys every node shares, and the condition language
               screen.ts    the screen document: 39 node types, collectsValue,
                            the submit-row-versus-buttons rule
               walk.ts      tree queries, and `containerDepth` — the nesting cap
               migrate.ts   legacy form and page JSON -> a screen, applied on every read
               registry.ts  per-type builder metadata; the renderer never reads it
               propSpecs.ts the per-type prop rows behind the settings panel
               workflowGraph.ts  graph queries, cycle breaking and the stage
                            ranking the Arrange button and the run indicator share
               the table and workflow documents, node factories
               samples/     the demo presets behind the Sample button
               __fixtures__/ sample documents frozen in their pre-merge shapes,
                            the inputs the migration tests run against
  src/renderer/  schema -> antd <Form> or <Table>. No builder imports.
               ScreenRenderer  the root: emits a <Form> only when something collects
               ScreenNodeView  one node, control or display
               screenContext   whether values are live or a finished payload
               remote/   the only network layer: URL templating, response
                         mapping, and a TTL body cache, shared by options and rows
               table/    schema -> antd <Table>: columns, cell formats, remote rows
               summary/  schema + payload -> a read-only confirmation page
               workflow/ the run engine: which branch is taken, and what comes next
  src/lib/     createId, shared by the factories and the builder
  docs/        SCHEMA.md — the authoring reference, tables regenerated from the registries
  scripts/     validateDocument, genSchemaDoc, genFixtures

apps/example/                     @antd-form-generator/example — this demo
  src/builder/ palette, canvas, inspector, toolbar, drag-and-drop
               table/    the table builder: data source, column list, column inspector
               workflow/ the graph builder: node cards, SVG branches, node and
                         branch inspectors, and the embedded screen editor
  src/custom/  the demo component registry this app passes to the renderer
  src/panes/   preview, summary and JSON tabs
  src/store/   one zustand store per document, each with its own localStorage
               key and undo/redo, plus the mode switch and the summary tab's
               sample values
  src/styles.css  every `.fg-*` rule
```

The app imports the library as `@antd-form-generator/core/<subpath>` — `schema/screen`,
`renderer/ScreenRenderer` and so on. Those subpaths resolve **straight to TypeScript source**: there
is no build step between the two packages, nothing is emitted, and editing a file in the library
hot-reloads the app. The cost is that library files are type-checked twice, once on their own and
once inside the app's program, which is why both tsconfigs extend one `tsconfig.base.json`.

Two rules keep the boundary honest:

- **Library code may not use the `@/` alias.** `@/` belongs to whichever app is compiling, so inside
  the library it would resolve into `apps/example/src`. The library's tsconfig declares no `paths` at
  all, so any `@/` fails there immediately. To check by hand, use `/usr/bin/grep -ran "'@/"
  packages/form-generator/src` — the `-a` matters, because two files hold a literal NUL byte (a
  deliberate join delimiter in `useFieldVisibility.ts` and `remote/useRemoteOptions.ts`) and plain
  grep skips them as binary.
- **The library owns no CSS.** It emits three class names it does not style — `fg-page`,
  `fg-summary` and `fg-summary__row` — and only the last has a rule, in this app's `styles.css`. A
  host that imports the library and not that file gets an unstyled repeatable row in its summary.
  Everything else the renderer draws is inline `style` props.

The builder panes bind to whichever screen document `ScreenStoreContext` supplies — the app-level one
by default, or a workflow node's embedded screen when the graph builder provides its own. That is
what lets the same palette, canvas and inspector edit a screen nested inside a workflow.

A page document needed none of the tree walking, because its blocks were flat. That is this store
with nothing nestable in it, which is why there is no second one: `addNode(type, ROOT_CONTAINER_ID,
index)` is what `addBlock` was.

## Screens were once forms and pages

Form and page were separate documents. They carried an identical five-key core, the same condition
language, the same registry-with-`supports` idiom, and the same place inside a workflow node — but
keeping them apart made the commonest real screen impossible to build, because a heading, a
paragraph, three fields, a callout and a submit needed half of each.

Nothing needs doing about it. Both legacy shapes are migrated wherever JSON is read — an imported
file, a paste into the JSON tab, a `localStorage` blob from an older build, or a form or page
embedded in a saved workflow:

| Was | Is now |
| --- | --- |
| a document with no `kind` and `fields[]` | `kind: "screen"` with `nodes[]` |
| `kind: "page"` with `blocks[]` | `kind: "screen"` with `nodes[]` |
| field type `title` | `heading`, its `label` moved to `text` |
| a `name` on `title` or `divider` | dropped — neither ever rendered a `Form.Item`, so neither ever held a payload key |
| workflow node kinds `form` and `page` | one `screen` kind, both payload keys folded into `screen` |
| `antd-form-generator:schema` / `:page` | `antd-form-generator:screen`, read from the old keys once |

`migrateToScreen` passes an already-migrated document straight through, so it is safe on every read
rather than something that has to run exactly once. The pre-merge sample documents are committed
under `packages/form-generator/src/schema/__fixtures__/` and the tests migrate them on every run, asserting that node counts,
payload keys and conditions all survive.

## Stack

antd 6 · React 19 · Rsbuild 2 · TypeScript · pnpm workspaces · zod 4 (schema + validation) · zustand 5 (state) · dnd-kit (drag and drop) · dayjs · Vitest

The library half of that list is short on purpose: `@antd-form-generator/core` depends on zod and
dayjs and peers on antd and React. zustand and dnd-kit belong to the example app, and a host that
imports the renderer never pulls them in.
