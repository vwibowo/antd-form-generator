/**
 * The app's only network layer.
 *
 * Caches *raw response bodies* rather than mapped options, keyed by the fully
 * resolved URL: editing `labelKey` in the inspector then re-maps instantly
 * with no second request.
 */

interface Entry {
  at: number;
  body: unknown;
}

const TTL_MS = 5 * 60_000;
/** Enough for a session of typing in a search box without growing unbounded. */
const MAX_ENTRIES = 200;

const cache = new Map<string, Entry>();

export function readCachedBody(url: string): { body: unknown } | undefined {
  const entry = cache.get(url);
  if (!entry) return undefined;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(url);
    return undefined;
  }
  return { body: entry.body };
}

function store(url: string, body: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(url, { at: Date.now(), body });
}

/** Drop everything. Exported for a future "reload options" affordance. */
export function clearOptionsCache(): void {
  cache.clear();
}

/**
 * Fetch one URL as JSON.
 *
 * `credentials: 'omit'` is load-bearing rather than cosmetic: a schema is a
 * shareable, importable file, so one user can hand another a JSON that makes
 * their browser fetch an arbitrary URL. Omitting credentials means those
 * requests can never be authenticated by the recipient's cookies.
 */
export async function loadBody(url: string, signal: AbortSignal): Promise<unknown> {
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported scheme ${parsed.protocol}`);
  }

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    // fetch rejects with a bare TypeError for both an offline network and a
    // blocked cross-origin read. The browser deliberately does not tell us
    // which, so neither can we.
    throw new Error('Network or CORS error');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Invalid JSON response');
  }

  store(parsed.toString(), body);
  return body;
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}
