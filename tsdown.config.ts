import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  clean: true,
  dts: true,
  target: 'node18',
  alias: {
    '@': path.resolve(root, 'src'),
  },
})
