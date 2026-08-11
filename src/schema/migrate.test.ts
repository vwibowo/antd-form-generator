import { describe, expect, it } from 'vitest';
import { fixturesOfKind } from './__fixtures__';
import { migrateToScreen, migrateWorkflowToScreens } from './migrate';
import type { ScreenNode, ScreenNodeType } from './screen';
import {
  collectScreenActions,
  isDisplayType,
  parseScreenSchema,
  walkScreenNodes,
} from './screen';

/**
 * The payoff for freezing the samples before the merge.
 *
 * These fixtures are the legacy `form` and `page` shapes exactly as the old
 * contracts produced them, so a census taken from the raw JSON and a census
 * taken from the migrated screen must agree. That is what turns "the migration
 * runs" into "the migration dropped nothing".
 */

interface LegacyNode {
  type?: unknown;
  name?: unknown;
  children?: unknown;
  condition?: unknown;
  actions?: unknown;
}

/** Flatten a legacy `fields[]` / `blocks[]` tree without parsing it. */
function walkLegacy(nodes: unknown): LegacyNode[] {
  if (!Array.isArray(nodes)) return [];
  const out: LegacyNode[] = [];
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) continue;
    const entry = node as LegacyNode;
    out.push(entry);
    out.push(...walkLegacy(entry.children));
  }
  return out;
}

/** `title` is the one type the merge renames; everything else must survive as-is. */
function expectedType(type: unknown): unknown {
  return type === 'title' ? 'heading' : type;
}

function legacyNodesOf(document: unknown): LegacyNode[] {
  const record = document as { fields?: unknown; blocks?: unknown };
  return walkLegacy(record.fields ?? record.blocks);
}

const LEGACY_SCREENS = [...fixturesOfKind('form'), ...fixturesOfKind('page')];

describe('migrateToScreen', () => {
  it.each(LEGACY_SCREENS)('$file becomes a valid screen', ({ document }) => {
    const result = parseScreenSchema(migrateToScreen(document));
    if (!result.ok) expect.unreachable(result.errors.join('\n'));
    expect(result.schema.kind).toBe('screen');
  });

  it.each(LEGACY_SCREENS)('$file keeps every node', ({ document }) => {
    const before = legacyNodesOf(document);
    const result = parseScreenSchema(migrateToScreen(document));
    if (!result.ok) expect.unreachable('did not migrate');
    const after = walkScreenNodes(result.schema.nodes);

    expect(after.length).toBe(before.length);
    expect(after.map((node) => node.type)).toEqual(before.map((node) => expectedType(node.type)));
  });

  it.each(LEGACY_SCREENS)('$file keeps every payload key', ({ document }) => {
    // A form gave `title` and `divider` a `name` too, but neither ever rendered
    // a `Form.Item`, so neither occupied a key. Migration drops those.
    const before = legacyNodesOf(document)
      .filter((node) => !isDisplayType(expectedType(node.type) as ScreenNodeType))
      .filter((node) => typeof node.name === 'string' && node.name !== '')
      .map((node) => node.name);

    const result = parseScreenSchema(migrateToScreen(document));
    if (!result.ok) expect.unreachable('did not migrate');
    const after = walkScreenNodes(result.schema.nodes)
      .filter((node) => node.name !== '')
      .map((node) => node.name);

    expect(after).toEqual(before);
  });

  it.each(LEGACY_SCREENS)('$file keeps every condition', ({ document }) => {
    const before = legacyNodesOf(document).filter((node) => node.condition !== undefined);
    const result = parseScreenSchema(migrateToScreen(document));
    if (!result.ok) expect.unreachable('did not migrate');
    const after = walkScreenNodes(result.schema.nodes).filter(
      (node) => node.condition !== undefined,
    );

    expect(after.length).toBe(before.length);
    expect(after.map((node) => node.condition)).toEqual(before.map((node) => node.condition));
  });

  it('carries a legacy title into the heading it becomes', () => {
    const migrated = migrateToScreen({
      fields: [{ id: 'a', type: 'title', name: 'x', label: 'Reference', props: { level: 2 } }],
    });
    const result = parseScreenSchema(migrated);
    if (!result.ok) expect.unreachable(result.errors.join('\n'));

    const [node] = result.schema.nodes;
    expect(node.type).toBe('heading');
    expect(node.text).toBe('Reference');
    // The level was authored in `props` and the page's `heading` reads it there
    // too, so it survives untouched.
    expect(node.props.level).toBe(2);
  });

  it('keeps every action a page offered', () => {
    const [page] = fixturesOfKind('page');
    const result = parseScreenSchema(migrateToScreen(page.document));
    if (!result.ok) expect.unreachable('did not migrate');

    expect(collectScreenActions(result.schema).map((action) => action.id)).toEqual([
      'online',
      'later',
    ]);
  });

  it('leaves an already-migrated screen alone', () => {
    const [form] = fixturesOfKind('form');
    const once = migrateToScreen(form.document);
    expect(migrateToScreen(once)).toBe(once);
  });

  it('does not touch a table or a workflow', () => {
    const table = { kind: 'table', columns: [] };
    const workflow = { kind: 'workflow', nodes: [] };
    expect(migrateToScreen(table)).toBe(table);
    expect(migrateToScreen(workflow)).toBe(workflow);
  });
});

describe('migrateWorkflowToScreens', () => {
  it.each(fixturesOfKind('workflow'))('$file collapses form and page nodes', ({ document }) => {
    const before = (document as { nodes: { kind: string }[] }).nodes;
    const legacyCount = before.filter((node) => node.kind === 'form' || node.kind === 'page').length;

    const after = migrateWorkflowToScreens(document) as {
      nodes: { kind: string; screen?: unknown; form?: unknown; page?: unknown }[];
    };

    expect(after.nodes.length).toBe(before.length);
    expect(after.nodes.filter((node) => node.kind === 'screen').length).toBe(legacyCount);
    // The old payload keys are gone, and every screen node carries a document.
    for (const node of after.nodes) {
      expect(node.form).toBeUndefined();
      expect(node.page).toBeUndefined();
      if (node.kind === 'screen') expect(node.screen).toBeDefined();
    }
  });

  it.each(fixturesOfKind('workflow'))('$file embeds parseable screens', ({ document }) => {
    const after = migrateWorkflowToScreens(document) as {
      nodes: { kind: string; screen?: unknown }[];
    };

    for (const node of after.nodes) {
      if (node.kind !== 'screen') continue;
      const result = parseScreenSchema(node.screen);
      if (!result.ok) expect.unreachable(result.errors.join('\n'));
    }
  });

  it.each(fixturesOfKind('workflow'))('$file keeps every embedded node', ({ document }) => {
    const before = (document as { nodes: Record<string, unknown>[] }).nodes;
    const legacyTotal = before.reduce(
      (sum, node) => sum + legacyNodesOf(node.form ?? node.page ?? {}).length,
      0,
    );

    const after = migrateWorkflowToScreens(document) as {
      nodes: { kind: string; screen?: unknown }[];
    };
    const migratedTotal = after.nodes.reduce((sum, node) => {
      if (node.kind !== 'screen') return sum;
      const result = parseScreenSchema(node.screen);
      return sum + (result.ok ? walkScreenNodes(result.schema.nodes as ScreenNode[]).length : 0);
    }, 0);

    expect(migratedTotal).toBe(legacyTotal);
    expect(legacyTotal).toBeGreaterThan(0);
  });
});
