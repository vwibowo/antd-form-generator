import { useCallback, useEffect, useState } from 'react';
import { useRendererConfig } from '../config/RendererConfigProvider';
import type { RendererError } from '../config/errors';
import { rendererError } from '../config/errors';
import { decideRequest } from '../config/policy';
import type { RendererRequestKind } from '../config/types';
import { describeError, isRendererError, loadBody } from './cache';

export interface FetchedBody {
  /** Parsed JSON, or `undefined` before the first successful load. */
  body: unknown;
  loading: boolean;
  error: string | null;
  /** Drop this URL from the cache and go again. */
  refetch: () => void;
}

const IDLE = { body: undefined, loading: false, error: null } as const;

/**
 * Fetch one URL, with the host's policy, cache and abort handling.
 *
 * Shared by remote options and remote table rows. Everything above it — which
 * URL to build, from which values, and what to do with the body — belongs to the
 * caller; this hook only knows how to go and get it.
 *
 * `requestUrl` must be a fully resolved string, or `null` to stand down. Keep it
 * a **primitive**: the builder store `structuredClone`s the document on every
 * edit, so keying this effect on any object would refire it on every keystroke.
 * That is also why `kind` is a string and the policy is read from context rather
 * than passed in.
 */
export function useFetchedBody(
  requestUrl: string | null,
  kind: RendererRequestKind,
): FetchedBody {
  const { policy, fetcher, onError, cache } = useRendererConfig();
  const [state, setState] = useState<Omit<FetchedBody, 'refetch'>>(IDLE);
  // Bumping this re-runs the effect without changing the URL.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestUrl) {
      setState(IDLE);
      return;
    }

    const pageOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const decision = decideRequest({ url: requestUrl, kind }, policy, pageOrigin);

    if (decision.kind === 'refuse') {
      const failure = rendererError(decision.code, decision.message, { url: requestUrl, kind });
      onError(failure);
      setState({ body: undefined, loading: false, error: failure.message });
      return;
    }

    const request = decision.request;
    const cached = cache.read(request.url);
    if (cached) {
      setState({ body: cached.body, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const go = fetcher ?? loadBody;
    go(request, controller.signal)
      .then((body) => {
        cache.store(request.url, body);
        setState({ body, loading: false, error: null });
      })
      .catch((error: unknown) => {
        // A dependency changed or the component unmounted — not a failure.
        if (controller.signal.aborted) return;
        const failure: RendererError = isRendererError(error)
          ? error
          : rendererError('network', describeError(error), {
              url: request.url,
              kind,
              cause: error,
            });
        onError(failure);
        setState({ body: undefined, loading: false, error: failure.message });
      });

    return () => controller.abort();
  }, [requestUrl, kind, policy, fetcher, onError, cache, attempt]);

  const refetch = useCallback(() => {
    if (requestUrl) {
      const pageOrigin =
        typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
      const decision = decideRequest({ url: requestUrl, kind }, policy, pageOrigin);
      if (decision.kind === 'send') cache.evict(decision.request.url);
    }
    setAttempt((count) => count + 1);
  }, [requestUrl, kind, policy, cache]);

  return { ...state, refetch };
}
