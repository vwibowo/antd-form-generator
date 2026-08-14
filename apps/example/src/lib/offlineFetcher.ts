import type { RendererFetcher } from '@antd-form-generator/core';

/**
 * Canned answers for the endpoints the sample documents read.
 *
 * The samples point at dummyjson.com because a demo that fetches nothing cannot
 * show remote options, cascading selects, debounced server search or server-side
 * table paging. But a demo that *requires* the internet is a demo that fails in
 * front of an audience, so `RendererConfigProvider` takes a `fetcher` and this
 * is one — the same seam a host would use to route requests through its own
 * client, with retries and tracing and auth, instead of the built-in `fetch`.
 *
 * Deliberately not exhaustive-by-URL: it matches on pathname so a document whose
 * URL carries different query parameters still resolves.
 */

const CATEGORIES = [
  { slug: 'laptops', name: 'Laptops', url: '' },
  { slug: 'smartphones', name: 'Smartphones', url: '' },
  { slug: 'furniture', name: 'Furniture', url: '' },
  { slug: 'groceries', name: 'Groceries', url: '' },
];

const PRODUCTS = [
  { id: 1, title: 'ThinkPad X1 Carbon', brand: 'Lenovo', price: 1499, rating: 4.6, description: 'Fourteen-inch business laptop.' },
  { id: 2, title: 'MacBook Air 15"', brand: 'Apple', price: 1299, rating: 4.8, description: 'Fanless, and quiet with it.' },
  { id: 3, title: 'Dell XPS 13', brand: 'Dell', price: 1199, rating: 4.3, description: 'Small bezels, smaller charger.' },
  { id: 4, title: 'Pixel 9 Pro', brand: 'Google', price: 999, rating: 4.5, description: 'The camera is the point.' },
  { id: 5, title: 'Galaxy S25', brand: 'Samsung', price: 949, rating: 4.4, description: 'Bright screen, heavy pocket.' },
  { id: 6, title: 'Standing desk', brand: 'Fully', price: 649, rating: 4.7, description: 'Goes up. Also down.' },
  { id: 7, title: 'Ergonomic chair', brand: 'Herman Miller', price: 1395, rating: 4.9, description: 'Your spine will write to thank you.' },
  { id: 8, title: 'Monitor arm', brand: 'Ergotron', price: 189, rating: 4.2, description: 'Frees the desk it clamps to.' },
  { id: 9, title: 'Mechanical keyboard', brand: 'Keychron', price: 129, rating: 4.1, description: 'Audible from the next room.' },
  { id: 10, title: 'Webcam 4K', brand: 'Logitech', price: 199, rating: 3.9, description: 'Makes the lighting the problem.' },
  { id: 11, title: 'Noise-cancelling headset', brand: 'Sony', price: 349, rating: 4.6, description: 'For open-plan survival.' },
  { id: 12, title: 'Desk lamp', brand: 'BenQ', price: 219, rating: 4.4, description: 'Lights the desk, not the screen.' },
];

const USERS = [
  { id: 1, email: 'ada.lovelace@example.com', company: { name: 'Analytical Engines' } },
  { id: 2, email: 'grace.hopper@example.com', company: { name: 'Compiler Works' } },
  { id: 3, email: 'alan.turing@example.com', company: { name: 'Bletchley Systems' } },
  { id: 4, email: 'katherine.johnson@example.com', company: { name: 'Orbital Mechanics' } },
  { id: 5, email: 'edsger.dijkstra@example.com', company: { name: 'Shortest Path' } },
  { id: 6, email: 'barbara.liskov@example.com', company: { name: 'Substitution Ltd' } },
];

const POST_TAGS = [
  { slug: 'history', name: 'History' },
  { slug: 'american', name: 'American' },
  { slug: 'crime', name: 'Crime' },
  { slug: 'fiction', name: 'Fiction' },
];

const RECIPE_TAGS = ['Italian', 'Pizza', 'Dessert', 'Quick', 'Vegetarian'];

/** Case-insensitive contains, over the fields a search box would plausibly hit. */
function matches(product: (typeof PRODUCTS)[number], term: string): boolean {
  const needle = term.toLowerCase();
  return (
    product.title.toLowerCase().includes(needle) ||
    product.brand.toLowerCase().includes(needle)
  );
}

/**
 * Answer the way dummyjson would.
 *
 * `delayMs` is not decoration: without it every request resolves before the
 * first paint and the loading states — which are a real part of the renderer —
 * are never visible.
 */
export function createOfflineFetcher(delayMs = 220): RendererFetcher {
  return async (request, signal) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

    const url = new URL(request.url);
    const path = url.pathname;
    const query = url.searchParams;

    // The samples include a deliberate 404 to demo the error state. Keeping it
    // failing offline is the point — a stub that made everything succeed would
    // hide the one document written to show a failure.
    if (path.includes('/no-such-endpoint')) {
      throw new Error('HTTP 404');
    }

    if (path.endsWith('/products/categories')) return CATEGORIES;
    if (path.endsWith('/posts/tags')) return POST_TAGS;
    if (path.endsWith('/recipes/tags')) return RECIPE_TAGS;

    if (path.includes('/products/category/')) {
      const slug = path.split('/products/category/')[1] ?? '';
      // The real API filters by category; the shape is what matters here, so a
      // deterministic slice per slug is enough to show a cascade working.
      const offset = CATEGORIES.findIndex((entry) => entry.slug === slug);
      const start = offset < 0 ? 0 : offset * 3;
      return { products: PRODUCTS.slice(start, start + 3), total: 3, skip: 0, limit: 3 };
    }

    if (path.includes('/users/search')) {
      const term = (query.get('q') ?? '').toLowerCase();
      const users = USERS.filter((user) => user.email.toLowerCase().includes(term));
      return { users, total: users.length, skip: 0, limit: users.length };
    }

    if (path.endsWith('/products/search') || path.endsWith('/products')) {
      const term = query.get('q') ?? '';
      const limit = Number(query.get('limit') ?? 10);
      const skip = Number(query.get('skip') ?? 0);
      const sortBy = query.get('sortBy');
      const order = query.get('order') === 'desc' ? -1 : 1;

      let found = term ? PRODUCTS.filter((product) => matches(product, term)) : [...PRODUCTS];
      if (sortBy) {
        found.sort((a, b) => {
          const left = (a as Record<string, unknown>)[sortBy];
          const right = (b as Record<string, unknown>)[sortBy];
          if (typeof left === 'number' && typeof right === 'number') return (left - right) * order;
          return String(left).localeCompare(String(right)) * order;
        });
      }
      // Paged server-side, so the catalogue table's `skip`/`limit` wiring and its
      // "selection survives paging" behaviour both get exercised offline.
      return { products: found.slice(skip, skip + limit), total: found.length, skip, limit };
    }

    if (path.endsWith('/users')) {
      const limit = Number(query.get('limit') ?? USERS.length);
      return { users: USERS.slice(0, limit), total: USERS.length, skip: 0, limit };
    }

    throw new Error(`No offline answer for ${path}`);
  };
}
