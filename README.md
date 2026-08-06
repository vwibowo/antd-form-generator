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

Then open http://localhost:3000. Click **Sample** in the header to load a demo form that exercises every feature.

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

## Layout

```
src/
  schema/      zod definitions (the single source of truth for shape, TS types, and validation),
               the field registry, node factory, and tree helpers
  renderer/    schema -> antd <Form>. No builder imports.
  builder/     palette, canvas, inspector, toolbar, drag-and-drop
  panes/       preview and JSON tabs
  store/       zustand store with localStorage persistence and undo/redo
```

## Stack

antd 6 · React 19 · Rsbuild 2 · TypeScript · zod 4 (schema + validation) · zustand 5 (state) · dnd-kit (drag and drop) · dayjs
