import { useEffect, useState } from 'react';
import { describeError, loadBody, readCachedBody } from './cache';

export interface FetchedBody {
  /** Parsed JSON, or `undefined` before the first successful load. */
  body: unknown;
  loading: boolean;
  error: string | null;
}

const IDLE: FetchedBody = { body: undefined, loading: false, error: null };

/**
 * Fetch one URL, with the app's cache and abort handling.
 *
 * Shared by remote options and remote table rows. Everything above it — which
 * URL to build, from which values, and what to do with the body — belongs to
 * the caller; this hook only knows how to go and get it.
 *
 * `requestUrl` must be a fully resolved string, or `null` to stand down. Keep
 * it a **primitive**: the store `structuredClone`s the document on every edit,
 * so keying this effect on any object would refire it on every keystroke.
 */
export function useFetchedBody(requestUrl: string | null): FetchedBody {
  const [state, setState] = useState<FetchedBody>(IDLE);

  useEffect(() => {
    if (!requestUrl) {
      setState(IDLE);
      return;
    }

    const cached = readCachedBody(requestUrl);
    if (cached) {
      setState({ body: cached.body, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    loadBody(requestUrl, controller.signal)
      .then((body) => setState({ body, loading: false, error: null }))
      .catch((error: unknown) => {
        // A dependency changed or the component unmounted — not a failure.
        if (controller.signal.aborted) return;
        setState({ body: undefined, loading: false, error: describeError(error) });
      });

    return () => controller.abort();
  }, [requestUrl]);

  return state;
}
