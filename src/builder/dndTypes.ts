import type { FieldType } from '@/schema/schema';

/** Payload attached to a palette entry being dragged onto the canvas. */
export interface PaletteDragData {
  source: 'palette';
  fieldType: FieldType;
}

/** Payload attached to an existing field being reordered. */
export interface FieldDragData {
  source: 'field';
  id: string;
  containerId: string;
  index: number;
  fieldType: FieldType;
}

/** Payload attached to a drop area that appends to the end of a container. */
export interface ContainerDropData {
  source: 'container';
  containerId: string;
}

export type DragData = PaletteDragData | FieldDragData | ContainerDropData;

export const PALETTE_ID_PREFIX = 'palette:';
export const CONTAINER_ID_PREFIX = 'container:';

export function paletteDraggableId(type: FieldType): string {
  return `${PALETTE_ID_PREFIX}${type}`;
}

export function containerDroppableId(containerId: string): string {
  return `${CONTAINER_ID_PREFIX}${containerId}`;
}
