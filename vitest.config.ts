import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Tests run against the source directly — no bundler involved, and no build
 * step between the packages either: `@antd-form-generator/core` resolves
 * through the workspace symlink to the same `.ts`/`.tsx` files the app compiles.
 *
 * One config with three projects rather than one config per package, so `npm
 * test` stays a single run with a single summary, and watch mode re-runs the
 * builder's tests when library source changes — `packages/builder/src/store` is
 * checked against rules that live in the library.
 *
 * The aliases mirror `paths` in `apps/example/tsconfig.json`. No project gets an
 * alias for itself: one would let a package self-import pass here while failing
 * `tsc` inside the package, which is the divergence the missing `paths` in each
 * package's tsconfig exists to prevent.
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
            '@antd-form-generator/core': at('./packages/form-generator/src'),
          },
        },
        test: {
          name: 'builder',
          root: at('./packages/builder'),
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        },
      },
      {
        // No test files today, and kept anyway: without this project a test
        // added under apps/example would be silently skipped by `npm test`
        // rather than run. Vitest only reports "no test files" when the
        // aggregate across projects is empty, so an empty one stays quiet.
        resolve: {
          alias: {
            '@antd-form-generator/builder': at('./packages/builder/src'),
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
