/**
 * A TTL cache of *raw response bodies*, keyed by resolved URL.
 *
 * Raw bodies rather than mapped options, so editing `labelKey` in the inspector
 * re-maps instantly with no second request. That was true before and still is.
 *
 * What changed is ownership. This used to be one `Map` at module scope, shared
 * by everything on the page. Once a host can attach headers to a request, that
 * is a leak: two configs — two tenants, two tokens — hitting one URL would read
 * each other's response. So a cache is now an instance, one per
 * `RendererConfigProvider`, and the default instance below is what a tree with
 * no provider uses, which is exactly the old behaviour.
 */

interface Entry {
  at: number;
  body: unknown;
}

const TTL_MS = 5 * 60_000;
/** Enough for a session of typing in a search box without growing unbounded. */
const MAX_ENTRIES = 200;

export interface ResponseCache {
  read(url: string): { body: unknown } | undefined;
  store(url: string, body: unknown): void;
  /** Drop one URL — what a host's `refetch()` uses. */
  evict(url: string): void;
  clear(): void;
}

export function createResponseCache(ttlMs = TTL_MS, maxEntries = MAX_ENTRIES): ResponseCache {
  const entries = new Map<string, Entry>();

  return {
    read(url) {
      const entry = entries.get(url);
      if (!entry) return undefined;
      if (Date.now() - entry.at > ttlMs) {
        entries.delete(url);
        return undefined;
      }
      return { body: entry.body };
    },
    store(url, body) {
      if (entries.size >= maxEntries) {
        // Map iterates in insertion order, so the first key is the oldest.
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
      entries.set(url, { at: Date.now(), body });
    },
    evict(url) {
      entries.delete(url);
    },
    clear() {
      entries.clear();
    },
  };
}

/** Used by any renderer not wrapped in a `RendererConfigProvider`. */
export const defaultResponseCache = createResponseCache();

/** A cache that remembers nothing, for `cache: false`. */
export const noResponseCache: ResponseCache = {
  read: () => undefined,
  store: () => undefined,
  evict: () => undefined,
  clear: () => undefined,
};
