import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests run against the source directly — no bundler involved.
 *
 * The alias mirrors `tsconfig.json`'s `@/*` path, which is the only build
 * config the sources depend on; everything else here is vitest's own default.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
