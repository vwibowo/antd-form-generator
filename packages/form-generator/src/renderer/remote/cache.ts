import type { RendererError } from '../config/errors';
import { rendererError } from '../config/errors';
import type { ResolvedRendererRequest } from '../config/types';

/**
 * The app's only network call.
 *
 * The request reaching here has already been through `config/policy.ts`, which
 * decided whether it may carry the host's headers and credentials. Read that
 * file before touching this one: `credentials: 'omit'` on an untrusted
 * destination is a security property, not a default, and the policy is what
 * preserves it now that a host can configure anything at all.
 *
 * Caching moved to `config/cache.ts` — a cache is per-provider now, because a
 * shared one would let two hosts with two tokens read each other's responses.
 */

/** Fetch one URL as JSON. Rejects with a `RendererError`. */
export async function loadBody(
  request: ResolvedRendererRequest,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(request.url, {
      signal,
      credentials: request.credentials,
      headers: { Accept: 'application/json', ...request.headers },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    // fetch rejects with a bare TypeError for both an offline network and a
    // blocked cross-origin read. The browser deliberately does not tell us
    // which, so neither can we.
    throw rendererError('network', 'Network or CORS error', {
      url: request.url,
      kind: request.kind,
      cause: error,
    });
  }

  if (!response.ok) {
    // The numeric status travels alongside the prose: a host retrying a 429
    // and a host reporting a 404 want different things, and a string cannot
    // be branched on.
    throw rendererError('http', `HTTP ${response.status}`, {
      url: request.url,
      kind: request.kind,
      status: response.status,
    });
  }

  try {
    return await response.json();
  } catch (error) {
    throw rendererError('invalid-json', 'Invalid JSON response', {
      url: request.url,
      kind: request.kind,
      cause: error,
    });
  }
}

/** Prose for anything that comes back from a failed load. */
export function describeError(error: unknown): string {
  if (isRendererError(error)) return error.message;
  return error instanceof Error ? error.message : 'Request failed';
}

export function isRendererError(error: unknown): error is RendererError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}
