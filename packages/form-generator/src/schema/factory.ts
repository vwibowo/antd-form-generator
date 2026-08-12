import { createId } from '../lib/ids';
import { SCREEN_REGISTRY } from './registry';
import type { ScreenNode, ScreenNodeType } from './screen';
import { collectsValue, screenNodeSchema } from './screen';
import { createEmptyTableSchema } from './table';
import { uniqueName } from './walk';

/**
 * Extra defaults for one specific node, on top of the type's registry entry.
 * A `custom` node uses this to arrive with its component already chosen.
 */
export interface CreateNodeSeed {
  namePrefix?: string;
  label?: string;
  props?: Record<string, unknown>;
}

/**
 * Build a new node of `type` with registry defaults applied.
 *
 * A display node gets no `name`: it can never own a payload key, so generating
 * a unique one would only put a value in the JSON that nothing reads.
 */
export function createNode(
  type: ScreenNodeType,
  existingNodes: ScreenNode[] = [],
  seed?: CreateNodeSeed,
): ScreenNode {
  const meta = SCREEN_REGISTRY[type];
  const { children, props, ...rest } = meta.defaults;

  return screenNodeSchema.parse({
    id: createId(type),
    type,
    ...(collectsValue(type)
      ? { name: uniqueName(existingNodes, seed?.namePrefix || meta.namePrefix) }
      : {}),
    ...rest,
    ...(seed?.label ? { label: seed.label } : {}),
    // Seeded props merge over the type's own, rather than replacing them.
    props: { ...(props ?? {}), ...(seed?.props ?? {}) },
    ...(meta.supports.children ? { children: children ? [...children] : [] } : {}),
    // A table node arrives with a parsed empty table rather than nothing, so
    // the inspector never has to special-case "not authored yet".
    ...(meta.supports.table ? { table: createEmptyTableSchema() } : {}),
    // A tab strip arrives with two tabs, because one tab is not a tab strip and
    // none is an empty box with no way to see what it is for. Built here rather
    // than in the registry's `defaults` so each instance gets fresh ids.
    ...(type === 'tabs'
      ? {
          children: [
            createNode('card', existingNodes, { label: 'First tab' }),
            createNode('card', existingNodes, { label: 'Second tab' }),
          ],
        }
      : {}),
  });
}

/**
 * Deep copy of a node (and its subtree) with fresh ids and a free name.
 *
 * Named `cloneNode` rather than `duplicateNode` because the store already has
 * an action by that name; two `duplicateNode`s in one import list is only ever
 * confusing.
 */
export function cloneNode(node: ScreenNode, existingNodes: ScreenNode[]): ScreenNode {
  const clone = structuredClone(node);

  const reassign = (target: ScreenNode, isRoot: boolean) => {
    target.id = createId(target.type);
    if (isRoot && collectsValue(target.type) && node.name !== '') {
      target.name = uniqueName(existingNodes, node.name);
    }
    target.children?.forEach((child) => reassign(child, false));
  };

  reassign(clone, true);
  return clone;
}
