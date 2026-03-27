import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

import pkg from './package.json' with { type: 'json' }

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  clean: true,
  dts: true,
  target: 'node18',
  define: {
    __CLEAN_VERSION__: JSON.stringify(pkg.version),
  },
  alias: {
    '@': path.resolve(root, 'src'),
  },
})
