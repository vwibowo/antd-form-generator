import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const HERE = dirname(fileURLToPath(import.meta.url));

// GitHub Pages serves the repo-root `dist/`, which is tracked in git. The app
// lives two levels down now, but the build still has to land up there.
const DIST = resolve(HERE, '../../dist');

// Two aliases come from `paths` in tsconfig.json, which Rsbuild reads directly
// (resolve.aliasStrategy defaults to 'prefer-tsconfig'): `@/*` for this app's
// own source, and `@antd-form-generator/core/*` for the library. The library
// resolves to `.ts`/`.tsx` source — there is no build step between the two
// packages, so an edit in the library hot-reloads here.
export default defineConfig(({ command }) => ({
  plugins: [pluginReact()],
  // Pin the project root so entry, tsconfig and the dev server behave the same
  // whether this runs from here or from the repo root via `pnpm --filter`.
  root: HERE,
  html: {
    title: 'antd Form Generator',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
  output: {
    distPath: { root: DIST },
    // `dist` is no longer a subdirectory of `root`, so the default 'auto' would
    // refuse to empty it and stale hashed assets would pile up in a tracked
    // directory. A plain `true` is worse: cleaning also runs on dev-server
    // startup, which would wipe the committed Pages build every time someone
    // ran `pnpm dev`. Gating on the command is what 'auto' would have done.
    cleanDistPath: command === 'build',
    // Resolve assets relative to the page rather than the domain root, so the
    // same bundle works at a root domain and under /<repo>/ on GitHub Pages.
    // Only affects production builds — `dev.assetPrefix` is separate.
    assetPrefix: 'auto',
  },
  server: {
    port: Number(process.env.PORT) || 3000,
  },
}));
