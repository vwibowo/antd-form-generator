import type { PageBlockType } from '@/schema/page';

/**
 * Drag payloads for the page canvas.
 *
 * Its own union, with `source` strings distinct from the form and workflow
 * builders' — the three are never mounted together, but a distinct tag turns a
 * mistake into a type error rather than a block dropped into a form.
 */

export interface BlockPaletteDragData {
  source: 'page-palette';
  blockType: PageBlockType;
}

export interface BlockDragData {
  source: 'page-block';
  id: string;
  index: number;
}

export interface PageDropData {
  source: 'page-end';
}

export type PageDragData = BlockPaletteDragData | BlockDragData | PageDropData;

export const PAGE_PALETTE_ID_PREFIX = 'page-palette:';
export const PAGE_END_ID = 'page-end';

export function blockPaletteDraggableId(type: PageBlockType): string {
  return `${PAGE_PALETTE_ID_PREFIX}${type}`;
}
