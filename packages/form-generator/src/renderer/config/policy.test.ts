import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, decideRequest, isAllowed } from './policy';
import type { RequestPolicy } from './policy';

/**
 * The one security property in the package, pinned down.
 *
 * A schema is a shareable, importable file, so `source.url` is
 * attacker-controlled in the general case. The rule that keeps a host's
 * credentials safe is that they attach to a destination the host named — never
 * to the renderer. Every test below is a way that rule could be got wrong.
 *
 * The allowlist matching is where the real bugs live. A suffix test passes
 * `evil-example.com`; a bare `startsWith` on the path passes `/v20` when the
 * host said `/v2`. Both are one character away from the correct code and
 * neither is visible in a browser.
 */

const PAGE = 'https://app.internal';

const policy = (over: Partial<RequestPolicy> = {}): RequestPolicy => ({
  ...DEFAULT_POLICY,
  headers: () => ({ Authorization: 'Bearer secret' }),
  credentials: 'include',
  ...over,
});

const send = (url: string, over: Partial<RequestPolicy> = {}) => {
  const decision = decideRequest({ url, kind: 'options' }, policy(over), PAGE);
  if (decision.kind !== 'send') throw new Error(`refused: ${decision.code}`);
  return decision.request;
};

describe('isAllowed', () => {
  const allowed = [new URL('https://api.example.com/v2')];

  it('matches the origin exactly, so a lookalike domain is not trusted', () => {
    // The whole reason this is not a suffix test.
    expect(isAllowed(new URL('https://evil-example.com/v2'), allowed)).toBe(false);
    expect(isAllowed(new URL('https://api.example.com.evil.test/v2'), allowed)).toBe(false);
    expect(isAllowed(new URL('https://api.example.com/v2'), allowed)).toBe(true);
  });

  it('treats scheme and port as part of the origin', () => {
    expect(isAllowed(new URL('http://api.example.com/v2'), allowed)).toBe(false);
    expect(isAllowed(new URL('https://api.example.com:8443/v2'), allowed)).toBe(false);
  });

  it('matches a path prefix on whole segments only', () => {
    expect(isAllowed(new URL('https://api.example.com/v2'), allowed)).toBe(true);
    expect(isAllowed(new URL('https://api.example.com/v2/things'), allowed)).toBe(true);
    // `/v20` starts with `/v2`, and is a different API.
    expect(isAllowed(new URL('https://api.example.com/v20'), allowed)).toBe(false);
    expect(isAllowed(new URL('https://api.example.com/v1'), allowed)).toBe(false);
  });

  it('ignores a trailing slash on the allowlist entry', () => {
    const trailing = [new URL('https://api.example.com/v2/')];
    expect(isAllowed(new URL('https://api.example.com/v2'), trailing)).toBe(true);
    expect(isAllowed(new URL('https://api.example.com/v2/things'), trailing)).toBe(true);
    expect(isAllowed(new URL('https://api.example.com/v20'), trailing)).toBe(false);
  });

  it('opens the whole origin when the entry has no path', () => {
    const origin = [new URL('https://api.example.com')];
    expect(isAllowed(new URL('https://api.example.com/anything/at/all'), origin)).toBe(true);
  });

  it('trusts nothing when the host allowlisted nothing', () => {
    expect(isAllowed(new URL('https://api.example.com/v2'), [])).toBe(false);
  });
});

describe('decideRequest', () => {
  const allowed = [new URL('https://api.example.com/v2')];

  it('sends host credentials to an allowlisted destination', () => {
    const request = send('https://api.example.com/v2/things', { allowed });
    expect(request.trusted).toBe(true);
    expect(request.headers).toEqual({ Authorization: 'Bearer secret' });
    expect(request.credentials).toBe('include');
  });

  it('strips them everywhere else, which is the whole point', () => {
    const request = send('https://evil.example/collect', { allowed });
    expect(request.trusted).toBe(false);
    expect(request.headers).toEqual({});
    expect(request.credentials).toBe('omit');
  });

  it('leaves a public API reachable after a host configures a baseUrl', () => {
    // Setting `baseUrl` must not break the sample documents that read
    // dummyjson.com — they are simply untrusted, not blocked.
    const request = send('https://dummyjson.com/products/search', {
      allowed,
      base: 'https://api.example.com/v2/',
    });
    expect(request.url).toBe('https://dummyjson.com/products/search');
    expect(request.headers).toEqual({});
  });

  it('resolves a relative URL against the host baseUrl, not the page', () => {
    const request = send('things?q=1', { allowed, base: 'https://api.example.com/v2/' });
    expect(request.url).toBe('https://api.example.com/v2/things?q=1');
    expect(request.trusted).toBe(true);
  });

  it('resolves against the page when no baseUrl was named', () => {
    const request = send('/local/things');
    expect(request.url).toBe('https://app.internal/local/things');
  });

  it('refuses a non-http scheme', () => {
    const decision = decideRequest(
      { url: 'javascript:alert(1)', kind: 'options' },
      policy(),
      PAGE,
    );
    expect(decision).toMatchObject({ kind: 'refuse', code: 'bad-scheme' });
  });

  it('refuses an unlisted destination only when the host asked for lockdown', () => {
    const open = decideRequest(
      { url: 'https://elsewhere.test/x', kind: 'rows' },
      policy({ allowed }),
      PAGE,
    );
    expect(open.kind).toBe('send');

    const locked = decideRequest(
      { url: 'https://elsewhere.test/x', kind: 'rows' },
      policy({ allowed, blockUnlisted: true }),
      PAGE,
    );
    expect(locked).toMatchObject({ kind: 'refuse', code: 'request-blocked' });
  });

  it('still trusts an allowlisted destination under lockdown', () => {
    const decision = decideRequest(
      { url: 'https://api.example.com/v2/things', kind: 'rows' },
      policy({ allowed, blockUnlisted: true }),
      PAGE,
    );
    expect(decision.kind).toBe('send');
  });

  it('cannot be escaped by a token that walks up out of the allowed path', () => {
    // `remote/url.ts` percent-encodes every substituted token, so `../` arrives
    // as `..%2F` and stays one path segment. This asserts the two layers
    // compose — the encoding alone, or the path check alone, would not do.
    const encoded = send(`https://api.example.com/v2/${encodeURIComponent('../v20/steal')}`, {
      allowed,
    });
    expect(encoded.trusted).toBe(true);
    expect(new URL(encoded.url).pathname.startsWith('/v2/')).toBe(true);

    // An unencoded traversal really does leave the prefix — and is caught.
    const raw = send('https://api.example.com/v2/../v20/steal', { allowed });
    expect(raw.trusted).toBe(false);
    expect(raw.headers).toEqual({});
  });

  it('defaults to exactly the old behaviour', () => {
    const decision = decideRequest(
      { url: 'https://api.example.com/v2/things', kind: 'options' },
      DEFAULT_POLICY,
      PAGE,
    );
    expect(decision).toMatchObject({
      kind: 'send',
      request: { trusted: false, headers: {}, credentials: 'omit' },
    });
  });

  it('asks for headers per request, so a rotated token is not captured', () => {
    let token = 'first';
    const live = policy({ allowed, headers: () => ({ Authorization: token }) });
    const url = 'https://api.example.com/v2/things';

    const before = decideRequest({ url, kind: 'options' }, live, PAGE);
    token = 'second';
    const after = decideRequest({ url, kind: 'options' }, live, PAGE);

    expect(before).toMatchObject({ request: { headers: { Authorization: 'first' } } });
    expect(after).toMatchObject({ request: { headers: { Authorization: 'second' } } });
  });
});
