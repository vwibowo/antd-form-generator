import { createId } from '@/lib/ids';
import type { PageBlock, PageBlockType } from './page';
import { pageBlockSchema } from './page';
import { PAGE_BLOCK_REGISTRY } from './pageRegistry';
import { createEmptyTableSchema } from './table';

/**
 * Build a new block of `type` with its registry defaults applied.
 *
 * Mirrors `createField` in `factory.ts`, minus the name plumbing — a block
 * carries no payload key, so there is nothing to keep unique.
 */
export function createPageBlock(type: PageBlockType): PageBlock {
  const meta = PAGE_BLOCK_REGISTRY[type];
  const { props, ...rest } = meta.defaults;

  return pageBlockSchema.parse({
    id: createId(type),
    type,
    ...rest,
    props: props ?? {},
    // A table block arrives with a parsed empty table rather than nothing, so
    // the inspector never has to special-case "not authored yet".
    ...(meta.supports.table ? { table: createEmptyTableSchema() } : {}),
  });
}

/** Copy of a block with a fresh id. */
export function duplicatePageBlock(block: PageBlock): PageBlock {
  const clone = structuredClone(block);
  clone.id = createId(block.type);
  return clone;
}
