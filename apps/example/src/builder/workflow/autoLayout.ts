import type { WorkflowEdge, WorkflowSchema } from '@antd-form-generator/core/schema/workflow';
import { assignColumns, findBackEdges } from '@antd-form-generator/core/schema/workflowGraph';
import { NODE_HEIGHT, NODE_WIDTH } from './edgeGeometry';

/**
 * Tidy a workflow into columns — the Arrange button.
 *
 * A layered (Sugiyama-style) layout, hand-rolled to keep the graph
 * dependency-free like the rest of this builder: break the cycles, put every
 * node in a column, order each column to cut crossings, then hand out
 * coordinates.
 *
 * Lives in `builder/` rather than `schema/` because arranging is a builder
 * action and this needs the card dimensions from `edgeGeometry` — the schema
 * layer importing from the builder would be backwards.
 *
 * The cycle-breaking and the column ranking are not builder concerns, though:
 * the workflow player needs the same ordering to say which stage a run is on.
 * Both live in `workflowGraph.ts` and are imported here.
 */

export interface LayoutOptions {
  columnGap?: number;
  rowGap?: number;
}

export interface Position {
  x: number;
  y: number;
}

/** Matches the 288 x 192 spacing both sample presets are authored at. */
const COLUMN_GAP = 80;
const ROW_GAP = 108;
const MARGIN = 48;
/** Clear air between the main graph and the band of unreachable nodes. */
const ORPHAN_GAP = 96;
/** Enough passes to settle the ordering; past this it stops paying for itself. */
const SWEEPS = 4;

/** Median of the neighbour positions, or -1 when a node has no neighbours. */
function median(values: number[]): number {
  if (values.length === 0) return -1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Reorder each column so branches cross as little as possible.
 *
 * The median heuristic: a node wants to sit level with the middle of whatever
 * it connects to in the neighbouring column. Sweeping forwards then backwards
 * a few times settles it.
 */
function orderColumns(columns: string[][], forward: WorkflowEdge[]): string[][] {
  const ordered = columns.map((column) => [...column]);

  const neighboursOf = (id: string, back: boolean) =>
    forward
      .filter((edge) => (back ? edge.to === id : edge.from === id))
      .map((edge) => (back ? edge.from : edge.to));

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    const backwards = sweep % 2 === 1;
    const order = backwards
      ? [...ordered.keys()].reverse()
      : [...ordered.keys()];

    for (const index of order) {
      const adjacent = backwards ? ordered[index + 1] : ordered[index - 1];
      if (!adjacent) continue;

      const rank = new Map(adjacent.map((id, position) => [id, position]));
      const scored = ordered[index].map((id, position) => ({
        id,
        position,
        score: median(
          neighboursOf(id, !backwards)
            .map((neighbour) => rank.get(neighbour))
            .filter((value): value is number => value !== undefined),
        ),
      }));

      // A node with nothing in the adjacent column keeps where it was, rather
      // than being swept to the top by a -1 score.
      ordered[index] = scored
        .sort((a, b) => {
          if (a.score === -1 || b.score === -1) return a.position - b.position;
          return a.score - b.score || a.position - b.position;
        })
        .map((entry) => entry.id);
    }
  }

  return ordered;
}

/**
 * New positions for every node, keyed by id.
 *
 * Pure — it computes and returns, the caller commits. That keeps the store free
 * of layout code and makes Arrange a single undoable step.
 */
export function autoLayout(
  schema: WorkflowSchema,
  options: LayoutOptions = {},
): Record<string, Position> {
  const columnGap = options.columnGap ?? COLUMN_GAP;
  const rowGap = options.rowGap ?? ROW_GAP;
  if (schema.nodes.length === 0) return {};

  const starts = schema.nodes.filter((node) => node.kind === 'start').map((node) => node.id);
  const back = findBackEdges(schema, starts);
  const forward = schema.edges.filter((edge) => !back.has(edge.id) && edge.from !== edge.to);

  const connected = new Set<string>();
  for (const edge of schema.edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }
  // "Orphan" means nothing touches it at all. A node wired into the graph but
  // unreachable from the start still belongs in the columns.
  const placed = new Set(
    schema.nodes.filter((node) => connected.has(node.id)).map((node) => node.id),
  );

  const columnOf = assignColumns(schema, forward, placed);

  const columns: string[][] = [];
  for (const node of schema.nodes) {
    if (!placed.has(node.id)) continue;
    const column = columnOf.get(node.id) ?? 0;
    (columns[column] ??= []).push(node.id);
  }
  for (let i = 0; i < columns.length; i += 1) columns[i] ??= [];

  const ordered = orderColumns(columns, forward);

  /* Coordinates ----------------------------------------------------------- */

  const rowStep = NODE_HEIGHT + rowGap;
  const positions: Record<string, Position> = {};
  const centres = new Map<string, number>();

  ordered.forEach((column, index) => {
    const x = MARGIN + index * (NODE_WIDTH + columnGap);

    // Each node wants to sit level with the middle of what feeds it, so a
    // branch runs as straight as it can. Sorting by that desire and then
    // spacing them out is what turns the wish into a column.
    const wanted = column.map((id, position) => {
      const parents = forward
        .filter((edge) => edge.to === id)
        .map((edge) => centres.get(edge.from))
        .filter((value): value is number => value !== undefined);
      return {
        id,
        position,
        desired:
          parents.length > 0
            ? parents.reduce((sum, value) => sum + value, 0) / parents.length
            : position * rowStep,
      };
    });

    wanted.sort((a, b) => a.desired - b.desired || a.position - b.position);

    let cursor = Number.NEGATIVE_INFINITY;
    for (const entry of wanted) {
      const y = Math.max(entry.desired, cursor);
      cursor = y + rowStep;
      positions[entry.id] = { x, y };
      centres.set(entry.id, y);
    }
  });

  /* Normalise, then park the orphans ------------------------------------- */

  const ys = Object.values(positions).map((position) => position.y);
  const shift = ys.length > 0 ? MARGIN - Math.min(...ys) : 0;
  let bottom = MARGIN;
  for (const position of Object.values(positions)) {
    position.y += shift;
    bottom = Math.max(bottom, position.y + NODE_HEIGHT);
  }

  // Nothing points at these, so they have no column to belong to. A band under
  // the graph keeps them findable instead of piling them onto column 0.
  const orphans = schema.nodes.filter((node) => !placed.has(node.id));
  orphans.forEach((node, index) => {
    positions[node.id] = {
      x: MARGIN + index * (NODE_WIDTH + columnGap),
      y: bottom + ORPHAN_GAP,
    };
  });

  return positions;
}
