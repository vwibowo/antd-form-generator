import type { WorkflowEdge, WorkflowNode } from '@/schema/workflow';
import type { ActiveDrag } from './dndTypes';

/**
 * Where node cards sit and how the lines between them are drawn.
 *
 * Pure arithmetic, no DOM measurement: the schema already holds every node's
 * position, so the edge layer can lay itself out without waiting for a render
 * pass or reading back element rectangles.
 *
 * Routing happens once, into a list of waypoints, and the style only decides
 * how those points are turned into an SVG `d`. Two routers could disagree about
 * where a branch goes; a router and two stringifiers cannot.
 */

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 84;
/** Empty space kept past the furthest node so the canvas can always grow. */
export const STAGE_PADDING = 320;
/** How far a branch runs straight out of a card before it turns. */
const STUB = 24;
/** Clearance between the cards and the lane a back-edge travels along. */
const LANE_GAP = 44;
/** Corner rounding for `step`, and the pull on a `curve`'s control handles. */
const CORNER = 16;

export interface Point {
  x: number;
  y: number;
}

/** How branches are drawn. Mirrors `edgeStyle` on the document. */
export type EdgeStyle = 'curve' | 'step';

/**
 * A node's position with an in-flight drag applied.
 *
 * The card itself is moved by a CSS transform while the gesture runs, and the
 * store only learns the new position on drop — so without this the branches
 * would be drawn from where the node used to be until the user lets go.
 *
 * Returns the node itself when it is not the one being dragged, so the common
 * case allocates nothing. A port drag moves no node at all.
 */
export function withDrag(node: WorkflowNode, drag: ActiveDrag | null): WorkflowNode {
  if (!drag || drag.kind !== 'node' || drag.id !== node.id) return node;
  return { ...node, x: node.x + drag.dx, y: node.y + drag.dy };
}

/* -------------------------------------------------------------------------- */
/* Port slots                                                                  */
/* -------------------------------------------------------------------------- */

export interface PortSlot {
  outIndex: number;
  outCount: number;
  inIndex: number;
  inCount: number;
}

/**
 * Which slot on a card's edge each branch gets.
 *
 * Without this every branch out of a node starts at the same pixel, so three
 * conditions leaving one step draw straight over each other.
 *
 * Outgoing branches are ordered the way the engine tries them — fallback last,
 * then `priority`, then document order, matching `orderedOutgoing`. The top
 * line is therefore the first branch tested, which makes the picture teach the
 * semantics. Sorting on those keys inline rather than calling `orderedOutgoing`
 * keeps this a function of the edge list alone, with no schema to thread in.
 */
export function edgePortSlots(edges: WorkflowEdge[]): Map<string, PortSlot> {
  const out = new Map<string, WorkflowEdge[]>();
  const into = new Map<string, WorkflowEdge[]>();

  edges.forEach((edge) => {
    out.set(edge.from, [...(out.get(edge.from) ?? []), edge]);
    into.set(edge.to, [...(into.get(edge.to) ?? []), edge]);
  });

  const slots = new Map<string, PortSlot>();
  const slotFor = (id: string): PortSlot =>
    slots.get(id) ?? { outIndex: 0, outCount: 1, inIndex: 0, inCount: 1 };

  for (const group of out.values()) {
    const order = group
      .map((edge, index) => ({ edge, index }))
      .sort(
        (a, b) =>
          Number(a.edge.isDefault) - Number(b.edge.isDefault) ||
          a.edge.priority - b.edge.priority ||
          a.index - b.index,
      );
    order.forEach(({ edge }, position) => {
      slots.set(edge.id, { ...slotFor(edge.id), outIndex: position, outCount: order.length });
    });
  }

  // Incoming keeps document order: an arrival has no evaluation order to show.
  for (const group of into.values()) {
    group.forEach((edge, position) => {
      slots.set(edge.id, { ...slotFor(edge.id), inIndex: position, inCount: group.length });
    });
  }

  return slots;
}

/** Where a slot sits down the height of a card: 1 of 3 -> 25%, 2 of 3 -> 50%. */
function slotOffset(index: number, count: number): number {
  return (NODE_HEIGHT * (index + 1)) / (count + 1);
}

/** Where a branch leaves a node — the right edge, at its own slot. */
export function outPort(node: WorkflowNode, slot?: PortSlot): Point {
  const y = slot ? slotOffset(slot.outIndex, slot.outCount) : NODE_HEIGHT / 2;
  return { x: node.x + NODE_WIDTH, y: node.y + y };
}

/** Where a branch arrives — the left edge, at its own slot. */
export function inPort(node: WorkflowNode, slot?: PortSlot): Point {
  const y = slot ? slotOffset(slot.inIndex, slot.inCount) : NODE_HEIGHT / 2;
  return { x: node.x, y: node.y + y };
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

export interface RouteOptions {
  selfLoop: boolean;
  /**
   * Y of the lane a back-edge travels along, below every card it passes. The
   * caller knows both endpoints' cards, so it computes this rather than this
   * module guessing at card heights it cannot see.
   */
  lane: number;
}

/**
 * The corner points a branch travels through, source first.
 *
 * A forward branch is just its two endpoints — the style rounds them into the
 * same curve the graph has always drawn. A branch pointing back to an earlier
 * step needs real corners: routed as a plain left-to-right curve it would cut
 * straight through every card in between.
 */
export function routeEdge(from: Point, to: Point, options: RouteOptions): Point[] {
  if (options.selfLoop) return [from, to];

  // Enough room to leave and arrive perpendicular; anything less and the two
  // stubs overlap into a kink.
  if (to.x > from.x + STUB * 2) return [from, to];

  const lane = options.lane;
  return [
    from,
    { x: from.x + STUB, y: from.y },
    { x: from.x + STUB, y: lane },
    { x: to.x - STUB, y: lane },
    { x: to.x - STUB, y: to.y },
    to,
  ];
}

/** The arc a branch back to its own node takes, since a curve would be a dot. */
function selfLoopPath(from: Point, to: Point): string {
  const r = NODE_HEIGHT * 0.6;
  return `M ${from.x} ${from.y} C ${from.x + r * 2} ${from.y - r}, ${to.x + r * 2} ${to.y + r}, ${to.x} ${to.y}`;
}

/** Horizontal pull on the handles, so short hops still read as curves. */
function handle(from: Point, to: Point): number {
  return Math.max(48, Math.abs(to.x - from.x) / 2);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Waypoints into an SVG `d`.
 *
 * Two points are drawn as the cubic the graph has always used, in both styles —
 * a lone elbow-free hop has no corners to differentiate. Beyond that, `step`
 * turns square corners with a small arc and `curve` rounds them off with a
 * quadratic through the same corner, so the two styles trace the same route.
 */
export function pathFromWaypoints(
  points: Point[],
  style: EdgeStyle,
  selfLoop = false,
): string {
  if (points.length < 2) return '';
  if (selfLoop) return selfLoopPath(points[0], points[points.length - 1]);

  const [first, ...rest] = points;
  if (rest.length === 1) {
    const to = rest[0];
    if (style === 'curve') {
      const dx = handle(first, to);
      return `M ${round(first.x)} ${round(first.y)} C ${round(first.x + dx)} ${round(first.y)}, ${round(to.x - dx)} ${round(to.y)}, ${round(to.x)} ${round(to.y)}`;
    }
    // A step's elbow turns halfway across, which is what keeps parallel
    // branches from stacking their vertical runs on top of each other.
    const mid = round((first.x + to.x) / 2);
    return `M ${round(first.x)} ${round(first.y)} L ${mid} ${round(first.y)} L ${mid} ${round(to.y)} L ${round(to.x)} ${round(to.y)}`;
  }

  let d = `M ${round(first.x)} ${round(first.y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const previous = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];

    // Never round further than half of either leg, or short segments invert.
    const radius = Math.min(
      CORNER,
      distance(previous, corner) / 2,
      distance(corner, next) / 2,
    );

    const entry = towards(corner, previous, radius);
    const exit = towards(corner, next, radius);

    d += ` L ${round(entry.x)} ${round(entry.y)}`;
    d += ` Q ${round(corner.x)} ${round(corner.y)}, ${round(exit.x)} ${round(exit.y)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${round(last.x)} ${round(last.y)}`;
  return d;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** A point `length` away from `origin`, in the direction of `target`. */
function towards(origin: Point, target: Point, length: number): Point {
  const total = distance(origin, target);
  if (total === 0) return origin;
  const ratio = length / total;
  return {
    x: origin.x + (target.x - origin.x) * ratio,
    y: origin.y + (target.y - origin.y) * ratio,
  };
}

/**
 * Halfway along the routed polyline — where a condition chip parks.
 *
 * Measured along the segments rather than from a bezier formula, so it lands on
 * the line in both styles, and on the lane rather than over a card for a
 * back-edge.
 */
export function waypointMidpoint(points: Point[], selfLoop = false): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (selfLoop) {
    const r = NODE_HEIGHT * 0.6;
    return { x: points[0].x + r * 1.5, y: points[0].y };
  }
  if (points.length === 2) {
    // The cubic's own midpoint, `(P0 + 3·P1 + 3·P2 + P3) / 8` at t = 0.5 —
    // a straight average would sit off a curve that bows.
    const [from, to] = points;
    const dx = handle(from, to);
    return {
      x: (from.x + 3 * (from.x + dx) + 3 * (to.x - dx) + to.x) / 8,
      y: (from.y + 3 * from.y + 3 * to.y + to.y) / 8,
    };
  }

  const lengths = points.slice(1).map((point, i) => distance(points[i], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    if (travelled + lengths[i] >= total / 2) {
      const into = total / 2 - travelled;
      return towards(points[i], points[i + 1], into);
    }
    travelled += lengths[i];
  }
  return points[points.length - 1];
}

/** Y of the lane a back-edge between these two cards should travel along. */
function backEdgeLane(from: WorkflowNode, to: WorkflowNode): number {
  return Math.max(from.y, to.y) + NODE_HEIGHT + LANE_GAP;
}

export interface RoutedEdge {
  points: Point[];
  selfLoop: boolean;
}

/**
 * Everything needed to draw one branch: its endpoints resolved through any
 * in-flight drag, its port slots applied, and its corners routed.
 *
 * The edge layer and the condition chips both go through here, so a chip can
 * never end up parked somewhere its own line does not go.
 *
 * Returns null when either end is missing — a document mid-edit may name a node
 * that has just been deleted.
 */
export function routeWorkflowEdge(
  edge: WorkflowEdge,
  nodes: Map<string, WorkflowNode>,
  slots: Map<string, PortSlot>,
  drag: ActiveDrag | null,
): RoutedEdge | null {
  const source = nodes.get(edge.from);
  const target = nodes.get(edge.to);
  if (!source || !target) return null;

  // `withDrag` first: every port and the lane below are derived from the live
  // position, which is what keeps a branch attached while its card moves.
  const from = withDrag(source, drag);
  const to = withDrag(target, drag);
  const slot = slots.get(edge.id);
  const selfLoop = edge.from === edge.to;

  return {
    selfLoop,
    points: routeEdge(outPort(from, slot), inPort(to, slot), {
      selfLoop,
      lane: backEdgeLane(from, to),
    }),
  };
}

/** How large the scrollable stage has to be to hold every node. */
export function stageSize(nodes: WorkflowNode[]): { width: number; height: number } {
  let right = 0;
  let bottom = 0;
  for (const node of nodes) {
    right = Math.max(right, node.x + NODE_WIDTH);
    bottom = Math.max(bottom, node.y + NODE_HEIGHT);
  }
  return { width: right + STAGE_PADDING, height: bottom + STAGE_PADDING };
}
