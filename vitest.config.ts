import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Tests run against the source directly — no bundler involved, and no build
 * step for the library either: `@antd-form-generator/core` resolves through the
 * workspace symlink to the same `.ts`/`.tsx` files the app compiles.
 *
 * One config with two projects rather than one config per package, so `pnpm
 * test` stays a single run with a single summary, and watch mode re-runs the
 * app's tests when library source changes — `apps/example/src/store` is checked
 * against rules that live in the library.
 *
 * The aliases mirror `paths` in `apps/example/tsconfig.json`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'form-generator',
          root: at('./packages/form-generator'),
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
      {
        resolve: {
          alias: {
            '@': at('./apps/example/src'),
            '@antd-form-generator/core': at('./packages/form-generator/src'),
          },
        },
        test: {
          name: 'example',
          root: at('./apps/example'),
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
    ],
  },
});
