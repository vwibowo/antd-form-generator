import type { RendererRequestKind } from './types';

/**
 * Why a request did not produce a body.
 *
 * A code as well as a message because the message is prose meant for a reader —
 * it lands in an `Alert` — and a host that wants to retry, report or count
 * failures needs something stable to branch on. `http` carries the numeric
 * status for the same reason: `HTTP 429` and `HTTP 404` want different
 * handling, and until now both were flattened into a string.
 */
export type RendererErrorCode =
  /** The document's URL could not be parsed, even against `baseUrl`. */
  | 'invalid-url'
  /** Not `http:` or `https:`. */
  | 'bad-scheme'
  /** `blockUnlistedRequests` is on and the destination is not allowlisted. */
  | 'request-blocked'
  /** Offline, DNS, or a blocked cross-origin read — the browser will not say which. */
  | 'network'
  /** The server answered, but not with 2xx. */
  | 'http'
  /** 2xx, but the body did not parse as JSON. */
  | 'invalid-json';

export interface RendererError {
  code: RendererErrorCode;
  /** Reader-facing prose. This is what the renderer puts on screen. */
  message: string;
  /** The resolved URL, when resolution got far enough to have one. */
  url?: string;
  kind?: RendererRequestKind;
  /** Present only for `code: 'http'`. */
  status?: number;
  /** The original throw, for a host that wants to log it. */
  cause?: unknown;
}

export function rendererError(
  code: RendererErrorCode,
  message: string,
  extra: Omit<RendererError, 'code' | 'message'> = {},
): RendererError {
  return { code, message, ...extra };
}
