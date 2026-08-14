import type { RendererError } from '@antd-form-generator/core';
import { RendererConfigProvider } from '@antd-form-generator/core';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createOfflineFetcher } from './offlineFetcher';

/**
 * The console's own settings, and the `RendererConfigProvider` they drive.
 *
 * Everything a host can say about how documents fetch lives in one provider, so
 * this app keeps one place to say it and a page (`/settings`) to change it from.
 * The error log is the visible half: `onError` is the only way a host hears
 * about a request that failed inside a renderer, and a demo that never shows one
 * is not demonstrating the seam.
 */

export interface ConsoleSettings {
  offline: boolean;
  allowedOrigins: string[];
  blockUnlisted: boolean;
}

interface ConsoleSettingsValue {
  settings: ConsoleSettings;
  update: (patch: Partial<ConsoleSettings>) => void;
  errors: RendererError[];
  clearErrors: () => void;
}

const DEFAULTS: ConsoleSettings = {
  // Offline by default so the demo works on a plane, in a meeting room with
  // captive-portal wifi, and in front of an audience.
  offline: true,
  allowedOrigins: ['https://dummyjson.com'],
  blockUnlisted: false,
};

const Ctx = createContext<ConsoleSettingsValue | null>(null);

export function useConsoleSettings(): ConsoleSettingsValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useConsoleSettings needs ConsoleSettingsProvider above it');
  return value;
}

export function ConsoleSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ConsoleSettings>(DEFAULTS);
  const [errors, setErrors] = useState<RendererError[]>([]);

  const update = useCallback((patch: Partial<ConsoleSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  const onError = useCallback((error: RendererError) => {
    // Newest first, and bounded: a cascading select that keeps failing should
    // not grow this without limit.
    setErrors((current) => [error, ...current].slice(0, 25));
  }, []);

  // Identity matters: the provider hands this down to every renderer below it,
  // and a new object each render would re-run their effects. The cache lives
  // inside the provider and is keyed to it, so churning this would also throw
  // away every response already fetched.
  const config = useMemo(
    () => ({
      fetcher: settings.offline ? createOfflineFetcher() : undefined,
      allowedOrigins: settings.allowedOrigins,
      blockUnlistedRequests: settings.blockUnlisted,
      onError,
    }),
    [settings.offline, settings.allowedOrigins, settings.blockUnlisted, onError],
  );

  const value = useMemo(
    () => ({ settings, update, errors, clearErrors }),
    [settings, update, errors, clearErrors],
  );

  return (
    <Ctx.Provider value={value}>
      <RendererConfigProvider config={config}>{children}</RendererConfigProvider>
    </Ctx.Provider>
  );
}
