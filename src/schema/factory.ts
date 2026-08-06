import { createId } from '@/lib/ids';
import { FIELD_REGISTRY } from './registry';
import type { FieldNode, FieldType } from './schema';
import { uniqueName } from './walk';

/**
 * Build a new node of `type` with registry defaults applied and a name that
 * does not collide with anything already in `existingFields`.
 */
export function createField(type: FieldType, existingFields: FieldNode[] = []): FieldNode {
  const meta = FIELD_REGISTRY[type];
  const { children, props, ...rest } = meta.defaults;

  return {
    id: createId(type),
    type,
    name: uniqueName(existingFields, meta.namePrefix),
    span: 24,
    disabled: false,
    hidden: false,
    rules: [],
    props: { ...(props ?? {}) },
    ...rest,
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
