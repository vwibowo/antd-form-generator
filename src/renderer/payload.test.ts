import { describe, expect, it } from 'vitest';
import { screenSchemaSchema } from '@/schema/screen';
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
