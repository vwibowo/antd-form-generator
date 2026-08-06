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
  server: {
    port: Number(process.env.PORT) || 3000,
  },
});
