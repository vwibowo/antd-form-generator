import { describe, expect, it } from 'vitest';
import { createOfflineFetcher } from './offlineFetcher';

/**
 * The stub that lets the demo work with no network.
 *
 * Worth testing because its failure mode is quiet: a sample document whose
 * endpoint is unmatched shows an empty select, which looks exactly like a select
 * nobody has filled in. These pin the shapes the option mapper and the table's
 * row reader expect — bare arrays, nested `products`, `total` for paging.
 */

const fetcher = createOfflineFetcher(0);
const never = new AbortController().signal;

/**
 * A request as the policy would hand it over — already resolved, and untrusted,
 * which is what every dummyjson URL is unless a host allowlists it.
 */
const get = (url: string) =>
  fetcher({ url, kind: 'options', trusted: false, headers: {}, credentials: 'omit' }, never);

describe('offline fetcher', () => {
  it('answers a bare array of objects', async () => {
    const body = await get('https://dummyjson.com/products/categories');
    expect(Array.isArray(body)).toBe(true);
    expect((body as { slug: string }[])[0].slug).toBeTruthy();
  });

  it('answers a bare array of plain strings', async () => {
    // The recipe tags sample exists to prove the mapper handles this shape.
    const body = await get('https://dummyjson.com/recipes/tags');
    expect((body as unknown[]).every((entry) => typeof entry === 'string')).toBe(true);
  });

  it('nests rows under the key the document reads with dataPath', async () => {
    const body = await get('https://dummyjson.com/products/category/laptops');
    expect(Array.isArray((body as { products: unknown[] }).products)).toBe(true);
  });

  it('filters a server search by the q parameter', async () => {
    const body = (await get('https://dummyjson.com/users/search?q=ada')) as {
      users: { email: string }[];
    };
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toContain('ada');
  });

  it('pages server-side, so the catalogue table has something to page', async () => {
    const first = (await get('https://dummyjson.com/products/search?limit=4&skip=0')) as {
      products: unknown[];
      total: number;
    };
    const second = (await get('https://dummyjson.com/products/search?limit=4&skip=4')) as {
      products: { id: number }[];
    };

    expect(first.products).toHaveLength(4);
    expect(first.total).toBeGreaterThan(4);
    // A different page, not the same one again — the bug that would make paging
    // look like it works while showing identical rows.
    expect(second.products[0].id).not.toBe((first.products[0] as { id: number }).id);
  });

  it('sorts when the document asks it to', async () => {
    const body = (await get(
      'https://dummyjson.com/products/search?limit=50&sortBy=price&order=asc',
    )) as { products: { price: number }[] };
    const prices = body.products.map((product) => product.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('keeps the deliberate failure failing', async () => {
    // The "Remote data" sample carries this endpoint on purpose, to demo the
    // error state. A stub that answered everything would hide the one document
    // written to show a failure.
    await expect(get('https://dummyjson.com/no-such-endpoint')).rejects.toThrow('HTTP 404');
  });

  it('says so rather than guessing at an endpoint it does not know', async () => {
    await expect(get('https://dummyjson.com/carts')).rejects.toThrow('No offline answer');
  });
});
