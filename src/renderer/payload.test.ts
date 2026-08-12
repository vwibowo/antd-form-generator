import { describe, expect, it } from 'vitest';
import { screenSchemaSchema } from '../schema/screen';
import { buildInitialValues, collectPayloadKeys } from './initialValues';

/**
 * Which nodes own a payload key, and which are only passed through.
 *
 * The merge made this worth pinning down. A `card` and a `group` contribute no
 * key of their own but their children contribute at the parent's scope, while a
 * `heading` or an `alert` contributes nothing and has no children to look
 * through. Those two cases look alike — both are "not a control" — and a
 * traversal that conflates them silently drops every field inside a card.
 */

const screen = (nodes: unknown[]) => screenSchemaSchema.parse({ nodes });

describe('payload keys', () => {
  it('reaches fields nested inside a card', () => {
    const schema = screen([
      {
        id: 'c1',
        type: 'card',
        label: 'Your details',
        children: [
          { id: 'f1', type: 'input', name: 'email', defaultValue: 'a@b.c' },
          { id: 'f2', type: 'input', name: 'phone' },
        ],
      },
    ]);

    // A transparent container keeps its children at the top level, so both
    // names land in the payload and the card itself contributes nothing.
    expect([...collectPayloadKeys(schema)].sort()).toEqual(['email', 'phone']);
    expect(buildInitialValues(schema)).toEqual({ email: 'a@b.c' });
  });

  it('reaches fields inside a group inside a card', () => {
    const schema = screen([
      {
        id: 'c1',
        type: 'card',
        children: [
          {
            id: 'g1',
            type: 'group',
            children: [{ id: 'f1', type: 'input', name: 'deep' }],
          },
        ],
      },
    ]);

    expect([...collectPayloadKeys(schema)]).toEqual(['deep']);
  });

  it('ignores display nodes entirely', () => {
    const schema = screen([
      { id: 'h', type: 'heading', text: 'Hello' },
      { id: 'a', type: 'alert', text: 'Careful' },
      { id: 'd', type: 'divider' },
      { id: 'act', type: 'actions', actions: [{ id: 'go', label: 'Go' }] },
      { id: 'f', type: 'input', name: 'only' },
    ]);

    expect([...collectPayloadKeys(schema)]).toEqual(['only']);
  });

  it('reaches fields in every tab, not just the open one', () => {
    const schema = screen([
      {
        id: 't1',
        type: 'tabs',
        children: [
          {
            id: 'c1',
            type: 'card',
            label: 'First',
            children: [{ id: 'f1', type: 'input', name: 'email' }],
          },
          {
            id: 'c2',
            type: 'card',
            label: 'Second',
            children: [{ id: 'f2', type: 'input', name: 'phone' }],
          },
        ],
      },
    ]);

    // A tab strip is chrome, exactly like a card: its panes contribute their
    // children's keys at the top level and nothing of their own. The renderer
    // backs this by keeping every pane mounted — `preserve={false}` would
    // otherwise take a hidden tab's values out of the submitted payload.
    expect([...collectPayloadKeys(schema)].sort()).toEqual(['email', 'phone']);
  });

  it('gives a list its own namespace', () => {
    const schema = screen([
      {
        id: 'l1',
        type: 'list',
        name: 'people',
        children: [{ id: 'f1', type: 'input', name: 'fullName' }],
      },
    ]);

    // The row field is nested under the list's key, not hoisted beside it.
    expect([...collectPayloadKeys(schema)]).toEqual(['people']);
  });
});
