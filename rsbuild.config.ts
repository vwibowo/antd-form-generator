import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// The `@/*` alias comes from `paths` in tsconfig.json — Rsbuild reads it
// directly (resolve.aliasStrategy defaults to 'prefer-tsconfig').
export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: 'antd Form Generator',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
  output: {
    // Resolve assets relative to the page rather than the domain root, so the
    // same bundle works at a root domain and under /<repo>/ on GitHub Pages.
    // Only affects production builds — `dev.assetPrefix` is separate.
    assetPrefix: 'auto',
  },
  server: {
    port: Number(process.env.PORT) || 3000,
  },
});
