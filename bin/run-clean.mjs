#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = path.join(pkgRoot, 'dist/cli.mjs')

/**
 * 直接加载与 `node dist/cli.mjs` 相同的入口；在 import 前改写 argv，等价于传入预设子命令/参数。
 * @param {string[]} presetArgs 例如 `['modules']` 或 `['--all']`
 */
export async function run(presetArgs) {
  process.argv[1] = mainPath
  process.argv.splice(2, 0, ...presetArgs)
  await import(pathToFileURL(mainPath))
}
