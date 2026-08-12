import type { ScreenNode, ScreenNodeType, ScreenSchema } from './screen';
import { collectsValue, isContainerType } from './screen';

/** Depth-first visit over every node in the tree, parents before children. */
export function walkNodes(
  nodes: ScreenNode[],
  visit: (node: ScreenNode, parent: ScreenNode | null) => void,
  parent: ScreenNode | null = null,
): void {
  for (const node of nodes) {
    visit(node, parent);
    if (node.children?.length) {
      walkNodes(node.children, visit, node);
    }
  }
}

export function findNode(nodes: ScreenNode[], id: string): ScreenNode | null {
  let found: ScreenNode | null = null;
  walkNodes(nodes, (node) => {
    if (node.id === id) found = node;
  });
  return found;
}

/** Returns the container node holding `id`, or null when it sits at the root. */
export function findParent(nodes: ScreenNode[], id: string): ScreenNode | null {
  let parent: ScreenNode | null = null;
  walkNodes(nodes, (node, nodeParent) => {
    if (node.id === id) parent = nodeParent;
  });
  return parent;
}

/**
 * How deeply a container is nested. 0 for one sitting at the root.
 *
 * What caps nesting. `tabs > card > list` is three levels of chrome, which is
 * as much as the JSON stays readable at and as much as a drop target stays
 * findable at.
 */
export function containerDepth(nodes: ScreenNode[], id: string): number {
  let depth = 0;
  let parent = findParent(nodes, id);
  while (parent) {
    depth += 1;
    parent = findParent(nodes, parent.id);
  }
  return depth;
}

/**
 * The sibling array that directly contains `id`, plus the index within it.
 * Returns null when the id is not in the tree.
 */
export function locate(
  schema: ScreenSchema,
  id: string,
): { siblings: ScreenNode[]; index: number } | null {
  const search = (nodes: ScreenNode[]): { siblings: ScreenNode[]; index: number } | null => {
    const index = nodes.findIndex((node) => node.id === id);
    if (index !== -1) return { siblings: nodes, index };
    for (const node of nodes) {
      if (node.children?.length) {
        const hit = search(node.children);
        if (hit) return hit;
      }
    }
    return null;
  };
  return search(schema.nodes);
}

/**
 * Resolve a container id to its children array.
 * `ROOT_CONTAINER_ID` maps to the schema's top-level field list.
 */
export const ROOT_CONTAINER_ID = '__root__';

export function getContainerChildren(
  schema: ScreenSchema,
  containerId: string,
): ScreenNode[] | null {
  if (containerId === ROOT_CONTAINER_ID) return schema.nodes;
  const node = findNode(schema.nodes, containerId);
  if (!node) return null;
  if (!node.children) node.children = [];
  return node.children;
}

/** Container id that owns `id` — used by drag-and-drop to know the source list. */
export function getContainerIdOf(schema: ScreenSchema, id: string): string {
  const parent = findParent(schema.nodes, id);
  return parent ? parent.id : ROOT_CONTAINER_ID;
}

/** True when `ancestorId` is `id` or contains it at any depth. */
export function isDescendantOf(
  nodes: ScreenNode[],
  ancestorId: string,
  id: string,
): boolean {
  if (ancestorId === id) return true;
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor?.children?.length) return false;
  return ancestor.children.some((child) => isDescendantOf(nodes, child.id, id));
}

/** Every value-carrying name in the tree, for the condition field picker. */
export function collectNames(nodes: ScreenNode[]): { name: string; label: string; id: string }[] {
  const out: { name: string; label: string; id: string }[] = [];
  walkNodes(nodes, (node) => {
    if (!collectsValue(node.type)) return;
    out.push({ name: node.name, label: node.label || node.name, id: node.id });
  });
  return out;
}

/** Names used more than once — surfaced as a builder warning, never blocking. */
export function findDuplicateNames(nodes: ScreenNode[]): string[] {
  const counts = new Map<string, number>();
  walkNodes(nodes, (node, parent) => {
    if (!collectsValue(node.type)) return;
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
export function uniqueName(nodes: ScreenNode[], base: string): string {
  const taken = new Set<string>();
  walkNodes(nodes, (node) => {
    if (node.name !== '') taken.add(node.name);
  });
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/* -------------------------------------------------------------------------- */
/* Drop rules                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cards are sections, so they take other containers — a repeatable belongs
 * inside one. Everything else stays flat: `group` and `list` hold plain nodes
 * only, and a tab strip holds only tabs.
 *
 * Nesting caps at three levels — `root > tabs > card > list` — which is as far
 * as both the drop logic and the generated JSON stay legible.
 */
export function canDropInto(
  schema: ScreenSchema,
  type: ScreenNodeType,
  containerId: string,
): boolean {
  if (containerId === ROOT_CONTAINER_ID) return true;
  const container = findNode(schema.nodes, containerId);
  if (!container || !isContainerType(container.type)) return false;

  // A tab strip holds tabs, and a tab is a card. Nothing else goes straight in:
  // a field dropped between two tabs has no tab to belong to.
  if (container.type === 'tabs') return type === 'card';

  if (isContainerType(type)) {
    // `group` and `list` hold plain nodes; only a card takes another container.
    if (container.type !== 'card') return false;
    // Depth rather than "the card must be top-level", which is what the rule
    // used to say — a card inside a tab strip is one level down and still has
    // to be able to take a repeatable.
    return containerDepth(schema.nodes, container.id) < 2;
  }
  return true;
}
