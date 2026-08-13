/**
 * What a host is allowed to say about the requests a *document* asks for.
 *
 * The distinction runs through this whole directory: a schema is a shareable,
 * importable file, so the URL in one is attacker-controlled in the general case.
 * A host's credentials therefore attach to a destination it named, never to the
 * renderer as a whole. See `policy.ts`.
 */

/** Why the renderer wants a URL. Lets a `headers` callback discriminate. */
export type RendererRequestKind = 'options' | 'rows';

/** A request as the document asked for it, before the policy has seen it. */
export interface RendererRequest {
  /**
   * The URL from the document, with `{{token}}`s already substituted and
   * percent-encoded by `remote/url.ts`. May be relative.
   */
  url: string;
  kind: RendererRequestKind;
}

/** A request the policy has approved, with what may be sent alongside it. */
export interface ResolvedRendererRequest extends RendererRequest {
  /** Absolute, and resolved against the host's `baseUrl` when it named one. */
  url: string;
  /**
   * Whether the destination is one the host allowlisted. `false` means this
   * request is made exactly the way every request was made before hosts could
   * configure anything: no host headers, `credentials: 'omit'`.
   */
  trusted: boolean;
  headers: Record<string, string>;
  credentials: RequestCredentials;
}

/**
 * Go and get one URL as JSON.
 *
 * Replacing this replaces the only network call the package makes — for a host
 * that already owns an HTTP client with retries and tracing, or for a test that
 * wants no network at all. Throw to fail; the thrown value reaches `onError` as
 * `cause`.
 */
export type RendererFetcher = (
  request: ResolvedRendererRequest,
  signal: AbortSignal,
) => Promise<unknown>;

/**
 * Reader-facing strings the renderer produces itself.
 *
 * Deliberately small. Most text on screen comes from the document, and the rest
 * is antd's own. These are the ones a host cannot reach any other way — and one
 * of them was simply wrong for an embedded host: `remoteMissingParams` used to
 * tell the reader to "set it under Parameters", naming a panel in the builder
 * that a host app does not have.
 */
export interface RendererLocale {
  /** `(names) => string`, for a remote source still waiting on a value. */
  remoteMissingParams: (names: string[]) => string;
  /** Prefix for a failed remote read. Receives the reason. */
  remoteError: (reason: string) => string;
  /** Shown where a table has loaded nothing. */
  emptyTable: string;
  /** Shown where a screen has no nodes. */
  emptyScreen: string;
}

export const DEFAULT_LOCALE: RendererLocale = {
  remoteMissingParams: (names) =>
    `Waiting on ${names.map((name) => `\`${name}\``).join(', ')}`,
  remoteError: (reason) => reason,
  emptyTable: 'No rows',
  emptyScreen: 'Nothing to show yet',
};

/**
 * Everything a host can say about how its documents are rendered.
 *
 * All optional, and every default reproduces the behaviour of a tree with no
 * provider at all — so wrapping an existing app in one changes nothing until a
 * field is set.
 */
export interface RendererConfig {
  /** Replace the network call entirely. */
  fetcher?: RendererFetcher;
  /** Where a document's relative URL points. Defaults to the page origin. */
  baseUrl?: string;
  /**
   * Destinations that may receive `headers` and `credentials`, as origins with
   * an optional path prefix: `https://api.example.com` or `.../v2`.
   *
   * Read `policy.ts` before changing how this is matched. A document's URL is
   * attacker-controlled in the general case, so this list is the only thing
   * standing between a host's token and a URL someone else chose.
   */
  allowedOrigins?: string[];
  /** Sent to allowlisted destinations only. A function is consulted per request. */
  headers?: Record<string, string> | ((request: RendererRequest) => Record<string, string>);
  /** Sent to allowlisted destinations only. Defaults to `'omit'`. */
  credentials?: RequestCredentials;
  /** Refuse anything not allowlisted, rather than sending it unauthenticated. */
  blockUnlistedRequests?: boolean;
  /** Every failed request, with a code to branch on. */
  onError?: (error: RendererErrorLike) => void;
  locale?: Partial<RendererLocale>;
  /** Pass `false` to disable caching, or an instance to share one deliberately. */
  cache?: ResponseCacheLike | false;
}

/* Structural aliases, so this module stays free of import cycles. */
type RendererErrorLike = import('./errors').RendererError;
type ResponseCacheLike = import('./cache').ResponseCache;
