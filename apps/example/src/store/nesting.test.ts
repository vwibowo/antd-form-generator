import { describe, expect, it } from 'vitest';
import { createNode } from '@antd-form-generator/core/schema/factory';
import { screenSchemaSchema } from '@antd-form-generator/core/schema/screen';
import { ROOT_CONTAINER_ID } from '@antd-form-generator/core/schema/walk';
import { canDropInto } from './useScreenStore';

/**
 * What may go inside what.
 *
 * The rule is `root > tabs > card > list` and it is enforced in one place, so
 * this is where it is written down. Adding `tabs` replaced "the receiving card
 * must be top-level" with a depth count; without these the change would look
 * fine and quietly stop a repeatable going into a tab.
 */

/** A tab strip with two tabs, exactly as the palette produces one. */
const tabbed = () => {
  const tabs = createNode('tabs');
  return { schema: screenSchemaSchema.parse({ nodes: [tabs] }), tabs };
};

describe('canDropInto', () => {
  it('seeds a fresh tab strip with two tabs, each a card', () => {
    const { tabs } = tabbed();
    expect(tabs.children).toHaveLength(2);
    expect(tabs.children?.map((tab) => tab.type)).toEqual(['card', 'card']);
    // Fresh ids per instance — the registry cannot hold these as static
    // defaults or two tab strips would share node ids.
    expect(tabs.children?.[0].id).not.toBe(tabs.children?.[1].id);
  });

  it('lets a tab strip sit at the root', () => {
    const { schema } = tabbed();
    expect(canDropInto(schema, 'tabs', ROOT_CONTAINER_ID)).toBe(true);
  });

  it('takes only cards directly inside a tab strip', () => {
    const { schema, tabs } = tabbed();
    expect(canDropInto(schema, 'card', tabs.id)).toBe(true);
    // A field between two tabs belongs to no tab.
    expect(canDropInto(schema, 'input', tabs.id)).toBe(false);
    expect(canDropInto(schema, 'list', tabs.id)).toBe(false);
    expect(canDropInto(schema, 'alert', tabs.id)).toBe(false);
  });

  it('allows a repeatable inside a card inside a tab strip', () => {
    const { schema, tabs } = tabbed();
    const tab = tabs.children![0];
    // Three levels: root > tabs > card > list. The old "card must be top-level"
    // rule would have refused this.
    expect(canDropInto(schema, 'list', tab.id)).toBe(true);
    expect(canDropInto(schema, 'input', tab.id)).toBe(true);
  });

  it('stops at three levels', () => {
    const tabs = createNode('tabs');
    const tab = tabs.children![0];
    const inner = createNode('list');
    tab.children = [inner];
    const schema = screenSchemaSchema.parse({ nodes: [tabs] });

    // root > tabs > card > list is the cap; nothing container-shaped goes deeper.
    expect(canDropInto(schema, 'card', inner.id)).toBe(false);
    expect(canDropInto(schema, 'input', inner.id)).toBe(true);
  });

  it('keeps group and repeatable holding plain nodes only', () => {
    const group = createNode('group');
    const list = createNode('list');
    const schema = screenSchemaSchema.parse({ nodes: [group, list] });

    expect(canDropInto(schema, 'card', group.id)).toBe(false);
    expect(canDropInto(schema, 'tabs', group.id)).toBe(false);
    expect(canDropInto(schema, 'card', list.id)).toBe(false);
    expect(canDropInto(schema, 'input', group.id)).toBe(true);
    expect(canDropInto(schema, 'input', list.id)).toBe(true);
  });
});
