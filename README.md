# antd Generator

Build an [Ant Design](https://github.com/ant-design/ant-design) **form** or **table** in a drag-and-drop UI, get a JSON schema out, and render that JSON back into a working component.

The JSON schema is the contract between the two halves. `src/renderer/` never imports anything from `src/builder/`, so it can be lifted into a standalone package as-is.

The **Form / Table** switch in the header chooses which document the three tabs are editing. They are separate documents with separate storage, undo stacks and export files — see [Table documents](#table-documents).

## Running it

```bash
pnpm install
```

```bash
pnpm dev
```

Then open http://localhost:3000. Click **Sample** in the header for the flagship demo, or use the arrow beside it to pick a preset for whichever document is active. In form mode:

| Preset | What it shows |
| --- | --- |
| **Purchase request** | A procurement flow that grows as you fill it in — a remote catalogue cascade, repeatable line items, and rules that only appear once the total passes 5,000. Opening the Preview fires exactly one request; every other one is caused by something you did. |
| **Remote data** | Every API response shape the option mapper handles, side by side: a bare array of objects, a bare array of plain strings, a nested `dataPath`, and a dot-path label. Plus cascading, debounced server-side search, and the HTTP error state. |
| **Kitchen sink** | Reference form. One of every field type, every per-type setting, every validation rule, and all nine condition operators. Horizontal layout with a fixed label column. |

In table mode the same button offers **Inline array** (rows pasted into the document, one column per cell format, with search, a derived Status filter and two bulk actions) and **API list** (dummyjson products, paged *and searched* on the server via `limit`/`skip`/`q`, with selection kept across pages).

Between them the presets cover every feature documented below, so they double as a manual regression suite.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 (set `PORT` to override) |
| `pnpm build` | Production bundle into `dist/` |
| `pnpm preview` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` |

## The three tabs

- **Builder** — palette on the left, canvas in the middle, inspector on the right. Drag from the palette onto the canvas, or click a palette entry to append. Drag the handle on a field card to reorder it or move it into a repeatable section. In table mode the left pane becomes the data source and column list instead.
- **Preview** — the schema rendered as a real, submittable form, with the resulting payload beside it. For a table, the table on its own.
- **JSON** — the schema as text. Edits apply to the builder the moment the JSON is valid; while it is invalid the errors are listed and the builder is left alone.

Each document is saved to its own `localStorage` key as you go, and **Export** / **Import** move it in and out as a `.json` file (`form-schema.json` / `table-schema.json`). Import reads the file's own `kind` and switches the mode to match, so you never have to pick the right one first.

## Field types

| Category | Types |
| --- | --- |
| Basic | text, textarea, password, number |
| Choice | select, radio group, checkbox group, checkbox, switch |
| Date & time | date, date range, time |
| Advanced | slider, rate, upload |
| Layout | divider, heading, group, card, repeatable |
| Custom | whatever the host app registers — see [Custom components](#custom-components) |

`group` (a plain fieldset) and `card` (an antd `Card` with a title) are **chrome only** — their children keep top-level names and do not nest in the payload. `repeatable` is a `Form.List`: it owns its name and its children become an array of objects.

Cards are page sections, so a card can hold other containers — including a repeatable. To keep the JSON legible that is capped: a container may only go into a card that is itself top-level, so nesting stops at `card > repeatable`. `group` and `repeatable` hold plain fields only.

## Form schema shape

```jsonc
{
  "version": 1,
  "title": "Conference registration",
  "layout": "vertical",          // horizontal | vertical | inline
  "size": "middle",
  "colon": true,
  "gutter": 16,
  "submitText": "Register",
  "showReset": true,
  "fields": [
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
    }
  ]
}
```

**Per-type control options** — `props` is a free-form bag holding the antd props for that field's control. Everything editable lives in `src/schema/propSpecs.ts`, which drives the inspector's settings panel; the renderer reads the same keys in `src/renderer/controls.tsx`. Adding a new prop means one spec entry and one read.

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
| title | `level`, `type`, `italic`, `underline` |
| divider | `titlePlacement`, `variant`, `size`, `plain` |
| card | `size`, `variant` |

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

**Conditional visibility** — any field can carry a `condition`:

```jsonc
"condition": {
  "logic": "and",                 // and | or
  "conditions": [
    { "field": "ticket", "operator": "eq", "value": "other" }
  ]
}
```

Operators: `eq`, `neq`, `in`, `notIn`, `gt`, `lt`, `contains`, `empty`, `notEmpty`. When a condition fails the field is unmounted and its `Form.Item` carries `preserve={false}`, so the value leaves the submitted payload rather than lingering.

Inside a repeatable row a condition resolves against that row first, then falls back to the top level — so a row field can react to its own sibling *and* to a form-level field.

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
- **Never put a token in the URL.** The schema is saved to `localStorage`, shown in the JSON tab, and included in every export. There is deliberately no headers, auth, or method field for the same reason; requests are GET with `credentials: 'omit'`. If you need authenticated option loading, pass it at runtime from the app embedding `FormRenderer`.

The builder canvas never fetches — it shows an inert placeholder while you drag and edit. Live requests happen in the Preview tab.

The **Remote data** sample preset is the live reference for all of this: each field in it reads a differently shaped response, so open its Options panel in the Builder to see how a given API maps onto `dataPath` / `labelKey` / `valueKey`.

## Table documents

Two things that are not forms: an array you already have, and an API that returns a list. Switch the
header to **Table** and the three tabs edit a table document instead.

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
`src/schema/tablePropSpecs.ts`: `size`, `bordered`, `showHeader`, `sticky`, `tableLayout`, `virtual`,
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

Under the hood both features share one network layer — `src/renderer/remote/useFetchedBody.ts` does
the caching, aborting and error strings for options and rows alike.

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
import { FormRenderer } from '@/renderer/FormRenderer';
import type { CustomComponentRegistry } from '@/renderer/custom';

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

<FormRenderer schema={schema} components={components} />
```

`value` and `onChange` are injected by `Form.Item`, exactly as for the antd controls — a component just reads one and calls the other. Anything else it needs comes from `node.props`, and each key it wants editable gets a `propSpecs` entry.

Wrap a subtree in `CustomComponentsProvider` instead of passing the prop, and the builder picks the registry up too: registered components appear in the palette's **Custom** group, and the canvas renders the real component rather than a stand-in. `src/App.tsx` does exactly that with the two demos in `src/custom/` — a colour picker, and a key/value editor that holds an array while editing and submits an object through its `serialize` hook.

Two things worth knowing:

- **A schema never carries code.** `props.component` is a name, resolved against a registry the app controls. An imported `.json` cannot introduce a component, only ask for one.
- **Unknown names degrade, they do not throw.** A form exported from an app that registered `signaturePad` and opened somewhere that did not shows a "not registered" notice in that field's place; every other field keeps working, and the inspector flags the missing name rather than silently rewriting it.

## Layout

```
src/
  schema/      zod definitions (the single source of truth for shape, TS types, and validation),
               the field registry, the per-type prop specs behind the settings
               panel, the table document, node factory, and tree helpers
               samples/ the demo presets behind the Sample button
  renderer/    schema -> antd <Form> or <Table>. No builder imports.
               remote/  the app's only network layer: URL templating, response
                        mapping, and a TTL body cache, shared by options and rows
               table/   schema -> antd <Table>: columns, cell formats, remote rows
  builder/     palette, canvas, inspector, toolbar, drag-and-drop
               table/   the table builder: data source, column list, column inspector
  custom/      the demo component registry this app passes to the renderer
  panes/       preview and JSON tabs
  store/       one zustand store per document, each with its own localStorage
               key and undo/redo, plus the Form/Table mode switch
```

## Stack

antd 6 · React 19 · Rsbuild 2 · TypeScript · zod 4 (schema + validation) · zustand 5 (state) · dnd-kit (drag and drop) · dayjs
