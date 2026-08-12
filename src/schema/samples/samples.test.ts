import { describe, expect, it } from 'vitest';
import { canDropInto } from '@/store/useScreenStore';
import type { ScreenNode, ScreenSchema } from '../screen';
import { isContainerType, walkScreenNodes } from '../screen';
import { ROOT_CONTAINER_ID, findParent } from '../walk';
import { WORKFLOW_SAMPLE_PRESETS } from './workflows';
import { SAMPLE_PRESETS } from './index';

/**
 * Every sample has to be something you could have built by dragging.
 *
 * The presets are authored as JSON, and zod does not police nesting — so a
 * hand-written sample can easily describe a tree the builder would refuse to
 * assemble. That is worse than a broken sample: it is a document the app ships,
 * renders, and then cannot reproduce. `accountSettings` was written one
 * container too deep and this is what caught it.
 */
function unbuildable(schema: ScreenSchema): string[] {
  const problems: string[] = [];
  for (const node of walkScreenNodes(schema.nodes)) {
    const parent = findParent(schema.nodes, node.id);
    const containerId = parent ? parent.id : ROOT_CONTAINER_ID;
    if (!canDropInto(schema, node.type, containerId)) {
      problems.push(`${node.type} "${node.label || node.name || node.id}" cannot go in ${parent?.type ?? 'the root'}`);
    }
  }
  return problems;
}

/** Containers holding containers, deepest first — what the nesting cap limits. */
function deepestContainerChain(nodes: ScreenNode[]): number {
  const depthOf = (node: ScreenNode): number => {
    if (!isContainerType(node.type)) return 0;
    const children = node.children ?? [];
    return 1 + Math.max(0, ...children.map(depthOf));
  };
  return Math.max(0, ...nodes.map(depthOf));
}

describe('screen samples', () => {
  it.each(SAMPLE_PRESETS)('$key could be built by dragging', ({ create }) => {
    expect(unbuildable(create())).toEqual([]);
  });

  it.each(SAMPLE_PRESETS)('$key stays within the nesting cap', ({ create }) => {
    // root > tabs > card > list is three containers deep, and that is the cap.
    expect(deepestContainerChain(create().nodes)).toBeLessThanOrEqual(3);
  });

  it('exercises the full nesting depth somewhere', () => {
    // If nothing reaches three, the cap is untested by the samples.
    const deepest = Math.max(
      ...SAMPLE_PRESETS.map((preset) => deepestContainerChain(preset.create().nodes)),
    );
    expect(deepest).toBe(3);
  });
});

describe('workflow samples', () => {
  it.each(WORKFLOW_SAMPLE_PRESETS)('$key embeds buildable screens', ({ create }) => {
    for (const node of create().nodes) {
      if (node.kind !== 'screen' || !node.screen) continue;
      expect(unbuildable(node.screen)).toEqual([]);
    }
  });
});
