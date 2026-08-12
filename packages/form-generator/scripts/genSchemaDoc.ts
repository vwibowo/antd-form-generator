import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_CATEGORIES, SCREEN_REGISTRY, nodesByCategory } from '../src/schema/registry';
import { CONDITION_OPERATORS, collectsValue } from '../src/schema/screen';
import { WORKFLOW_NODE_KINDS } from '../src/schema/workflow';
import { WORKFLOW_REGISTRY } from '../src/schema/workflowRegistry';

/**
 * Rewrite the generated tables inside `docs/SCHEMA.md`.
 *
 * The reference exists so an agent can author a document without reading the
 * app's source. Which means it lists every node type — and a hand-maintained
 * list of those is a list that goes stale: this project's README carried a wrong
 * node count twice within a week of the type set changing.
 *
 * So the tables come from the registries that already hold the truth, and the
 * prose around them is hand-written and preserved. Only the text between a
 * matching pair of markers is replaced.
 */

const DOC = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'SCHEMA.md');

/**
 * Which keys carry a node's content — the thing most often got wrong, because
 * `label` and `text` look interchangeable and are not.
 *
 * Ordered by how a reader would ask "where does the words go", with the couple
 * of types whose answer is neither named outright.
 */
function contentKeys(type: string): string {
  const meta = SCREEN_REGISTRY[type as keyof typeof SCREEN_REGISTRY];
  const collects = collectsValue(type as never);

  if (type === 'spacer') return '`props.height`';
  if (type === 'divider') return '`label` (inline caption)';
  if (type === 'custom') return '`name`, `label`, `props.component`';

  if (meta.supports.text) return '`text`';
  if (meta.supports.image) return '`src`, `alt`';
  if (meta.supports.items) return '`items[]`';
  if (meta.supports.actions) return '`actions[]`';
  if (meta.supports.table) return '`table`';
  if (meta.supports.summarySource) return '`summarySource`';
  if (meta.supports.children) {
    // A `list` owns a payload key and nests its children under it; `group`,
    // `card` and `tabs` are chrome and contribute nothing of their own.
    return collects ? '`name`, `label`, `children[]`' : '`label`, `children[]`';
  }
  return collects ? '`name`, `label`' : '`label`';
}

function nodeTypeTable(): string {
  const rows: string[] = [
    '| Type | Category | Collects a value? | Content keys |',
    '| --- | --- | --- | --- |',
  ];
  for (const category of NODE_CATEGORIES) {
    for (const meta of nodesByCategory(category)) {
      const collects = collectsValue(meta.type) ? 'yes' : 'no';
      rows.push(`| \`${meta.type}\` | ${category} | ${collects} | ${contentKeys(meta.type)} |`);
    }
  }
  return rows.join('\n');
}

function workflowKindTable(): string {
  const rows: string[] = ['| Kind | What it does | Holds a screen? |', '| --- | --- | --- |'];
  for (const kind of WORKFLOW_NODE_KINDS) {
    const meta = WORKFLOW_REGISTRY[kind];
    rows.push(`| \`${kind}\` | ${meta.hint} | ${meta.supports.holdsScreen ? 'yes' : 'no'} |`);
  }
  return rows.join('\n');
}

function operatorList(): string {
  return CONDITION_OPERATORS.map((op) => `\`${op}\``).join(' · ');
}

const BLOCKS: Record<string, () => string> = {
  'node-types': nodeTypeTable,
  'workflow-kinds': workflowKindTable,
  'condition-operators': operatorList,
};

let doc = readFileSync(DOC, 'utf8');
let replaced = 0;

for (const [name, build] of Object.entries(BLOCKS)) {
  const open = `<!-- generated:${name} -->`;
  const close = `<!-- /generated:${name} -->`;
  const start = doc.indexOf(open);
  const end = doc.indexOf(close);
  if (start === -1 || end === -1) {
    console.error(`missing markers for "${name}" — expected ${open} … ${close}`);
    process.exit(1);
  }
  doc = `${doc.slice(0, start + open.length)}\n${build()}\n${doc.slice(end)}`;
  replaced += 1;
}

writeFileSync(DOC, doc);
console.log(`regenerated ${replaced} block(s) in docs/SCHEMA.md`);
