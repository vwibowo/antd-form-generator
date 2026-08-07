# antd Form Generator

Build an [Ant Design](https://github.com/ant-design/ant-design) form in a drag-and-drop UI, get a JSON schema out, and render that JSON back into a working form.

The JSON schema is the contract between the two halves. `src/renderer/` never imports anything from `src/builder/`, so it can be lifted into a standalone package as-is.

## Running it

```bash
pnpm install
```

```bash
pnpm dev
```

Then open http://localhost:3000. Click **Sample** in the header for the flagship demo, or use the arrow beside it to pick one of three presets:

| Preset | What it shows |
| --- | --- |
| **Purchase request** | A procurement flow that grows as you fill it in — a remote catalogue cascade, repeatable line items, and rules that only appear once the total passes 5,000. Opening the Preview fires exactly one request; every other one is caused by something you did. |
| **Remote data** | Every API response shape the option mapper handles, side by side: a bare array of objects, a bare array of plain strings, a nested `dataPath`, and a dot-path label. Plus cascading, debounced server-side search, and the HTTP error state. |
| **Kitchen sink** | Reference form. One of every field type, every per-type setting, every validation rule, and all nine condition operators. Horizontal layout with a fixed label column. |

Between them the presets cover every feature documented below, so they double as a manual regression suite.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 (set `PORT` to override) |
| `pnpm build` | Production bundle into `dist/` |
| `pnpm preview` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` |

## The three tabs

- **Builder** — palette on the left, canvas in the middle, inspector on the right. Drag from the palette onto the canvas, or click a palette entry to append. Drag the handle on a field card to reorder it or move it into a repeatable section.
- **Preview** — the schema rendered as a real, submittable form, with the resulting payload beside it.
- **JSON** — the schema as text. Edits apply to the builder the moment the JSON is valid; while it is invalid the errors are listed and the builder is left alone.

Work is saved to `localStorage` as you go, and **Export** / **Import** move it in and out as a `.json` file.

## Field types

| Category | Types |
| --- | --- |
| Basic | text, textarea, password, number |
| Choice | select, radio group, checkbox group, checkbox, switch |
| Date & time | date, date range, time |
| Advanced | slider, rate, upload |
| Layout | divider, heading, group, card, repeatable |

`group` (a plain fieldset) and `card` (an antd `Card` with a title) are **chrome only** — their children keep top-level names and do not nest in the payload. `repeatable` is a `Form.List`: it owns its name and its children become an array of objects.

Cards are page sections, so a card can hold other containers — including a repeatable. To keep the JSON legible that is capped: a container may only go into a card that is itself top-level, so nesting stops at `card > repeatable`. `group` and `repeatable` hold plain fields only.

## Schema shape

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

## Layout

```
src/
  schema/      zod definitions (the single source of truth for shape, TS types, and validation),
               the field registry, node factory, and tree helpers
               samples/ the three demo presets behind the Sample button
  renderer/    schema -> antd <Form>. No builder imports.
               remote/  the app's only network layer: URL templating, response
                        mapping, and a TTL body cache for remote options
  builder/     palette, canvas, inspector, toolbar, drag-and-drop
  panes/       preview and JSON tabs
  store/       zustand store with localStorage persistence and undo/redo
```

## Stack

antd 6 · React 19 · Rsbuild 2 · TypeScript · zod 4 (schema + validation) · zustand 5 (state) · dnd-kit (drag and drop) · dayjs
