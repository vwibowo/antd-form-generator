import type { FieldNode, FormSchema } from './schema';
import { isPresentationalType, isTransparentContainer } from './schema';

/** Depth-first visit over every node in the tree, parents before children. */
export function walkFields(
  fields: FieldNode[],
  visit: (node: FieldNode, parent: FieldNode | null) => void,
  parent: FieldNode | null = null,
): void {
  for (const node of fields) {
    visit(node, parent);
    if (node.children?.length) {
      walkFields(node.children, visit, node);
    }
  }
}

export function findField(fields: FieldNode[], id: string): FieldNode | null {
  let found: FieldNode | null = null;
  walkFields(fields, (node) => {
    if (node.id === id) found = node;
  });
  return found;
}

/** Returns the container node holding `id`, or null when it sits at the root. */
export function findParent(fields: FieldNode[], id: string): FieldNode | null {
  let parent: FieldNode | null = null;
  walkFields(fields, (node, nodeParent) => {
    if (node.id === id) parent = nodeParent;
  });
  return parent;
}

/**
 * The sibling array that directly contains `id`, plus the index within it.
 * Returns null when the id is not in the tree.
 */
export function locate(
  schema: FormSchema,
  id: string,
): { siblings: FieldNode[]; index: number } | null {
  const search = (fields: FieldNode[]): { siblings: FieldNode[]; index: number } | null => {
    const index = fields.findIndex((node) => node.id === id);
    if (index !== -1) return { siblings: fields, index };
    for (const node of fields) {
      if (node.children?.length) {
        const hit = search(node.children);
        if (hit) return hit;
      }
    }
    return null;
  };
  return search(schema.fields);
}

/**
 * Resolve a container id to its children array.
 * `ROOT_CONTAINER_ID` maps to the schema's top-level field list.
 */
export const ROOT_CONTAINER_ID = '__root__';

export function getContainerChildren(
  schema: FormSchema,
  containerId: string,
): FieldNode[] | null {
  if (containerId === ROOT_CONTAINER_ID) return schema.fields;
  const node = findField(schema.fields, containerId);
  if (!node) return null;
  if (!node.children) node.children = [];
  return node.children;
}

/** Container id that owns `id` — used by drag-and-drop to know the source list. */
export function getContainerIdOf(schema: FormSchema, id: string): string {
  const parent = findParent(schema.fields, id);
  return parent ? parent.id : ROOT_CONTAINER_ID;
}

/** True when `ancestorId` is `id` or contains it at any depth. */
export function isDescendantOf(
  fields: FieldNode[],
  ancestorId: string,
  id: string,
): boolean {
  if (ancestorId === id) return true;
  const ancestor = findField(fields, ancestorId);
  if (!ancestor?.children?.length) return false;
  return ancestor.children.some((child) => isDescendantOf(fields, child.id, id));
}

/** Every value-carrying field name in the tree, for the condition field picker. */
export function collectNames(fields: FieldNode[]): { name: string; label: string; id: string }[] {
  const out: { name: string; label: string; id: string }[] = [];
  walkFields(fields, (node) => {
    if (isPresentationalType(node.type) || isTransparentContainer(node.type)) return;
    out.push({ name: node.name, label: node.label || node.name, id: node.id });
  });
  return out;
}

/** Names used more than once — surfaced as a builder warning, never blocking. */
export function findDuplicateNames(fields: FieldNode[]): string[] {
  const counts = new Map<string, number>();
  walkFields(fields, (node, parent) => {
    if (isPresentationalType(node.type) || isTransparentContainer(node.type)) return;
    // List rows have their own namespace, so only compare within a scope.
    const scope = parent?.type === 'list' ? parent.id : '__root__';
    const key = `${scope}::${node.name}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key.split('::')[1]);
}

/** Lowest unused `${base}N` name across the whole tree. */
export function uniqueName(fields: FieldNode[], base: string): string {
  const taken = new Set<string>();
  walkFields(fields, (node) => taken.add(node.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}
