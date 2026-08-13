import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { ResponseCache } from './cache';
import { createResponseCache, defaultResponseCache, noResponseCache } from './cache';
import type { RendererError } from './errors';
import type { RequestPolicy } from './policy';
import { DEFAULT_POLICY } from './policy';
import type { RendererConfig, RendererLocale } from './types';
import { DEFAULT_LOCALE } from './types';

/**
 * Host-wide settings for every renderer below it.
 *
 * Separate from `CustomComponentsProvider` on purpose: that one carries host
 * *code* and is usually one constant for the life of the app, while this
 * carries host *configuration* — a token that rotates, a base URL that differs
 * per environment. Different owners, different lifetimes, and keeping them
 * apart means a token refresh does not re-provide the component registry.
 *
 * Context rather than props is what makes a nested renderer work: a `table`
 * node inside a screen gets no props from anyone, and before this it also got
 * no configuration.
 */

/** The config as the renderer actually uses it, with defaults filled in. */
export interface ResolvedRendererConfig {
  policy: RequestPolicy;
  fetcher: RendererConfig['fetcher'];
  onError: (error: RendererError) => void;
  locale: RendererLocale;
  cache: ResponseCache;
}

const DEFAULT_CONFIG: ResolvedRendererConfig = {
  policy: DEFAULT_POLICY,
  fetcher: undefined,
  onError: () => undefined,
  locale: DEFAULT_LOCALE,
  cache: defaultResponseCache,
};

const RendererConfigContext = createContext<ResolvedRendererConfig>(DEFAULT_CONFIG);

export interface RendererConfigProviderProps {
  config: RendererConfig;
  children: ReactNode;
}

export function RendererConfigProvider({ config, children }: RendererConfigProviderProps) {
  // A provider owns one cache, so two configs against one URL cannot read each
  // other's response. `cache: false` opts out; passing an instance shares one
  // deliberately. The identity has to survive re-renders or every token
  // refresh would throw the cache away, hence the memo on `config.cache` alone.
  const ownCache = useMemo(
    () => (config.cache === undefined ? createResponseCache() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity is the point
    [],
  );

  const resolved = useMemo<ResolvedRendererConfig>(() => {
    const headers = config.headers;
    return {
      policy: {
        base: config.baseUrl,
        // Parsed once here rather than per request. An entry that will not parse
        // is dropped rather than throwing: a typo in configuration should cost
        // that destination its credentials, not the whole page.
        allowed: (config.allowedOrigins ?? []).flatMap((entry) => {
          try {
            return [new URL(entry)];
          } catch {
            return [];
          }
        }),
        credentials: config.credentials ?? 'omit',
        blockUnlisted: config.blockUnlistedRequests ?? false,
        headers:
          typeof headers === 'function' ? headers : headers ? () => headers : () => ({}),
      },
      fetcher: config.fetcher,
      onError: config.onError ?? (() => undefined),
      locale: { ...DEFAULT_LOCALE, ...config.locale },
      cache:
        config.cache === false
          ? noResponseCache
          : (config.cache ?? ownCache ?? defaultResponseCache),
    };
  }, [
    config.baseUrl,
    config.allowedOrigins,
    config.credentials,
    config.blockUnlistedRequests,
    config.headers,
    config.fetcher,
    config.onError,
    config.locale,
    config.cache,
    ownCache,
  ]);

  return (
    <RendererConfigContext.Provider value={resolved}>{children}</RendererConfigContext.Provider>
  );
}

export function useRendererConfig(): ResolvedRendererConfig {
  return useContext(RendererConfigContext);
}
