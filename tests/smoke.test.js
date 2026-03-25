import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const cli = path.resolve(process.cwd(), 'dist/cli.mjs')

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))
    })
    child.on('error', reject)
  })
}

async function exists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

async function mkfile(p, content = '') {
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, content, 'utf8')
}

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'clean-smoke-'))

  // Case 1: standalone package
  const single = path.join(tmp, 'single')
  await mkfile(path.join(single, 'package.json'), JSON.stringify({ name: 'single' }))
  await fs.mkdir(path.join(single, 'node_modules'), { recursive: true })
  await fs.mkdir(path.join(single, 'dist'), { recursive: true })

  await run('node', [cli, '--cwd', single, 'modules'])
  if (await exists(path.join(single, 'node_modules'))) {
    throw new Error('single: node_modules should be removed')
  }
  await run('node', [cli, '--cwd', single, 'dist'])
  if (await exists(path.join(single, 'dist'))) {
    throw new Error('single: dist should be removed')
  }

  // Case 2: pnpm monorepo, run inside packages/a
  const mono = path.join(tmp, 'mono')
  await mkfile(path.join(mono, 'package.json'), JSON.stringify({ name: 'mono', private: true }))
  await mkfile(path.join(mono, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
  await mkfile(path.join(mono, 'packages/a/package.json'), JSON.stringify({ name: 'a' }))
  await mkfile(path.join(mono, 'packages/b/package.json'), JSON.stringify({ name: 'b' }))
  await fs.mkdir(path.join(mono, 'packages/a/node_modules'), { recursive: true })
  await fs.mkdir(path.join(mono, 'packages/b/node_modules'), { recursive: true })
  await fs.mkdir(path.join(mono, 'packages/a/dist'), { recursive: true })
  await fs.mkdir(path.join(mono, 'packages/b/dist'), { recursive: true })

  // Add a cache file outside node_modules to verify cache phase still runs.
  await mkfile(path.join(mono, 'packages/a/.eslintcache'), 'a')
  await mkfile(path.join(mono, 'packages/b/.eslintcache'), 'b')

  // Default: clean only closest package root (packages/a), should not remove packages/b/node_modules
  await run('node', [cli, '--cwd', path.join(mono, 'packages/a'), 'modules'])
  if (await exists(path.join(mono, 'packages/a/node_modules'))) {
    throw new Error('mono default: packages/a node_modules should be removed')
  }
  if (!(await exists(path.join(mono, 'packages/b/node_modules')))) {
    throw new Error('mono default: packages/b node_modules should still exist')
  }

  // Default dist cleanup: only nearest package
  await run('node', [cli, '--cwd', path.join(mono, 'packages/a'), 'dist'])
  if (await exists(path.join(mono, 'packages/a/dist'))) {
    throw new Error('mono default: packages/a dist should be removed')
  }
  if (!(await exists(path.join(mono, 'packages/b/dist')))) {
    throw new Error('mono default: packages/b dist should still exist')
  }

  // Default: --all should also remove packages/a caches, but keep packages/b caches.
  await run('node', [cli, '--cwd', path.join(mono, 'packages/a'), '--all'])
  if (await exists(path.join(mono, 'packages/a/.eslintcache'))) {
    throw new Error('mono --all default: packages/a/.eslintcache should be removed')
  }
  if (!(await exists(path.join(mono, 'packages/b/.eslintcache')))) {
    throw new Error('mono --all default: packages/b/.eslintcache should still exist')
  }
  if (!(await exists(path.join(mono, 'packages/b/dist')))) {
    throw new Error('mono --all default: packages/b dist should still exist')
  }

  // With --root: clean whole workspace, should remove packages/b/node_modules too
  await run('node', [cli, '--cwd', path.join(mono, 'packages/a'), '--root', 'modules'])
  if (await exists(path.join(mono, 'packages/b/node_modules'))) {
    throw new Error('mono --root: packages/b node_modules should be removed')
  }

  // With --root: dist should clean whole workspace too
  await run('node', [cli, '--cwd', path.join(mono, 'packages/a'), '--root', 'dist'])
  if (await exists(path.join(mono, 'packages/b/dist'))) {
    throw new Error('mono --root dist: packages/b dist should be removed')
  }

  // With --root: --all should also remove packages/b cache file.
  await run('node', [cli, '--cwd', path.join(mono, 'packages/a'), '--root', '--all'])
  if (await exists(path.join(mono, 'packages/b/.eslintcache'))) {
    throw new Error('mono --root --all: packages/b/.eslintcache should be removed')
  }

  // Case 3: --cwd outside current tree should not pick unrelated parent clean.config.*
  const outsider = path.join(tmp, 'outsider')
  const outsiderRun = path.join(outsider, 'run')
  const target = path.join(outsider, 'target')
  await mkfile(
    path.join(outsiderRun, 'clean.config.cjs'),
    'module.exports = { modules: { enabled: false } }\n'
  )
  await mkfile(path.join(target, 'package.json'), JSON.stringify({ name: 'target' }))
  await fs.mkdir(path.join(target, 'node_modules'), { recursive: true })

  await run('node', [cli, '--cwd', target, 'modules'], { cwd: outsiderRun })
  if (await exists(path.join(target, 'node_modules'))) {
    throw new Error('cwd outside tree: target/node_modules should be removed')
  }

  console.log('smoke: ok')
}

main().catch(e => {
  console.error(e)
  process.exitCode = 1
})
