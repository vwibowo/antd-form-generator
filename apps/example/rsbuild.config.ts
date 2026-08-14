import { copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RsbuildPlugin } from '@rsbuild/core';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const HERE = dirname(fileURLToPath(import.meta.url));

// GitHub Pages serves the repo-root `dist/`, which is tracked in git. The app
// lives two levels down now, but the build still has to land up there.
const DIST = resolve(HERE, '../../dist');

/**
 * Where the app is mounted, for the router only.
 *
 * `assetPrefix: 'auto'` below keeps *assets* working at any subpath without
 * being told where they are, but a BrowserRouter cannot infer its own basename
 * that way — `import.meta.env.ASSET_PREFIX` is a build-time define and would be
 * the literal string `auto`. So the base is named at build time and reaches the
 * app as `import.meta.env.BASE_URL`.
 *
 * Locally the default is right. A GitHub Pages build wants
 * `BASE_PATH=/<repo>/ npm run build`; forget it and the app still loads at its
 * root, only deep links break.
 */
const BASE = process.env.BASE_PATH || '/';

/**
 * Copy `index.html` to `404.html` after a build.
 *
 * GitHub Pages has no history fallback: a reload on `/<repo>/library` asks for a
 * file that was never built and gets Pages' own 404 page. Pages *does* serve a
 * repo's `404.html` for any miss, so an identical copy boots the app instead,
 * and the router — which still sees the original path — takes it from there.
 */
const pagesFallback: RsbuildPlugin = {
  name: 'example:pages-404-fallback',
  setup(api) {
    api.onAfterBuild(async () => {
      await copyFile(join(DIST, 'index.html'), join(DIST, '404.html'));
    });
  },
};

// Two aliases come from `paths` in tsconfig.json, which Rsbuild reads directly
// (resolve.aliasStrategy defaults to 'prefer-tsconfig'): `@/*` for this app's
// own source, and `@antd-form-generator/core/*` for the library. The library
// resolves to `.ts`/`.tsx` source — there is no build step between the two
// packages, so an edit in the library hot-reloads here.
export default defineConfig(({ command }) => ({
  plugins: [pluginReact(), pagesFallback],
  // Pin the project root so entry, tsconfig and the dev server behave the same
  // whether this runs from here or from the repo root via `npm --workspace`.
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
    // ran `npm run dev`. Gating on the command is what 'auto' would have done.
    cleanDistPath: command === 'build',
    // Resolve assets relative to the page rather than the domain root, so the
    // same bundle works at a root domain and under /<repo>/ on GitHub Pages.
    // Only affects production builds — `dev.assetPrefix` is separate.
    assetPrefix: 'auto',
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    // Feeds `import.meta.env.BASE_URL`, which is the router's basename.
    base: BASE,
    // Off by default in Rsbuild, so without this a reload on any route but `/`
    // asks the dev server for a file that does not exist.
    historyApiFallback: true,
  },
}));
