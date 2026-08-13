import type { RendererRequest, ResolvedRendererRequest } from './types';

/**
 * Who may be sent what, and the one rule that makes host credentials safe.
 *
 * `credentials: 'omit'` and "no headers, ever" used to be unconditional, and
 * that was load-bearing rather than lazy: a schema is a shareable, importable
 * file, so one person can hand another a JSON whose `source.url` points
 * anywhere. An unauthenticated GET to a stranger's server is a shrug; the same
 * GET carrying the reader's session is an exfiltration.
 *
 * A plain `headers` setting would reopen exactly that. So credentials belong to
 * a **destination the host named**, never to the app: a URL the host did not
 * allowlist is fetched the way every URL was fetched before this file existed.
 * Everything else here is convenience arranged around that one branch.
 *
 * Pure on purpose — no React, and `window` only reaches it as the caller's
 * `pageOrigin` argument. That keeps the security property unit-testable in the
 * node environment, which is where `policy.test.ts` runs.
 */
export interface RequestPolicy {
  /** The host's `baseUrl`, already parsed. Relative document URLs resolve here. */
  base?: string;
  /** Destinations whose requests may carry `headers` and `credentials`. */
  allowed: URL[];
  /** Applied to allowlisted destinations only. */
  credentials: RequestCredentials;
  /** When set, an unlisted destination is not fetched at all. */
  blockUnlisted: boolean;
  /** Consulted per request, so a token can be read fresh rather than captured. */
  headers: (request: RendererRequest) => Record<string, string>;
}

export type RequestRefusalCode = 'invalid-url' | 'bad-scheme' | 'request-blocked';

export type RequestDecision =
  | { kind: 'send'; request: ResolvedRendererRequest }
  | { kind: 'refuse'; code: RequestRefusalCode; message: string };

export const DEFAULT_POLICY: RequestPolicy = {
  allowed: [],
  credentials: 'omit',
  blockUnlisted: false,
  headers: () => ({}),
};

/**
 * Decide what may be sent to a URL a document chose.
 *
 * `pageOrigin` is passed in rather than read from `window` so this stays pure;
 * a host that named a `base` has said where relative means, and one that did not
 * keeps the old behaviour of resolving against the page.
 */
export function decideRequest(
  request: RendererRequest,
  policy: RequestPolicy,
  pageOrigin: string,
): RequestDecision {
  let parsed: URL;
  try {
    parsed = new URL(request.url, policy.base ?? pageOrigin);
  } catch {
    return { kind: 'refuse', code: 'invalid-url', message: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      kind: 'refuse',
      code: 'bad-scheme',
      message: `Unsupported scheme ${parsed.protocol}`,
    };
  }

  const trusted = isAllowed(parsed, policy.allowed);

  if (!trusted && policy.blockUnlisted) {
    return {
      kind: 'refuse',
      code: 'request-blocked',
      message: `${parsed.origin} is not in this app's allowed origins`,
    };
  }

  const url = parsed.toString();
  return {
    kind: 'send',
    request: {
      ...request,
      url,
      trusted,
      // The security property, in two lines. An unlisted destination gets
      // precisely the request it would have got before hosts could configure
      // anything, which is also why setting a `baseUrl` cannot break a schema
      // that reads a public API.
      headers: trusted ? policy.headers({ ...request, url }) : {},
      credentials: trusted ? policy.credentials : 'omit',
    },
  };
}

/**
 * Is this URL under one of the host's allowlisted prefixes?
 *
 * An entry is an origin, optionally with a path: `https://api.example.com` or
 * `https://api.example.com/v2`.
 *
 * Origin must match **exactly**. No wildcards, and deliberately not a suffix
 * test — `https://evil-example.com` ends with `example.com`, and
 * `https://api.example.com.evil.test` contains it. A path, when given, must
 * match on whole segments, so `/v2` does not also open `/v20`.
 */
export function isAllowed(url: URL, allowed: URL[]): boolean {
  return allowed.some((prefix) => {
    if (url.origin !== prefix.origin) return false;
    if (prefix.pathname === '/' || prefix.pathname === '') return true;
    const bare = prefix.pathname.replace(/\/$/, '');
    return url.pathname === bare || url.pathname.startsWith(`${bare}/`);
  });
}
