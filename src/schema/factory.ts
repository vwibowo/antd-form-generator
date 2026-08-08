import { createId } from '@/lib/ids';
import { FIELD_REGISTRY } from './registry';
import type { FieldNode, FieldType } from './schema';
import { uniqueName } from './walk';

/**
 * Extra defaults for one specific node, on top of the type's registry entry.
 * A `custom` field uses this to arrive with its component already chosen.
 */
export interface CreateFieldSeed {
  namePrefix?: string;
  label?: string;
  props?: Record<string, unknown>;
}

/**
 * Build a new node of `type` with registry defaults applied and a name that
 * does not collide with anything already in `existingFields`.
 */
export function createField(
  type: FieldType,
  existingFields: FieldNode[] = [],
  seed?: CreateFieldSeed,
): FieldNode {
  const meta = FIELD_REGISTRY[type];
  const { children, props, ...rest } = meta.defaults;

  return {
    id: createId(type),
    type,
    name: uniqueName(existingFields, seed?.namePrefix || meta.namePrefix),
    span: 24,
    disabled: false,
    hidden: false,
    rules: [],
    ...rest,
    ...(seed?.label ? { label: seed.label } : {}),
    // Seeded props merge over the type's own, rather than replacing them.
    props: { ...(props ?? {}), ...(seed?.props ?? {}) },
    ...(meta.supports.children ? { children: children ? [...children] : [] } : {}),
  };
}

/** Deep copy of a node (and its subtree) with fresh ids and a free name. */
export function duplicateField(node: FieldNode, existingFields: FieldNode[]): FieldNode {
  const clone = structuredClone(node);

  const reassign = (target: FieldNode, isRoot: boolean) => {
    target.id = createId(target.type);
    if (isRoot) {
      target.name = uniqueName(existingFields, node.name);
    }
    target.children?.forEach((child) => reassign(child, false));
  };

  reassign(clone, true);
  return clone;
}
