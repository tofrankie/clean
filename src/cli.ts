import process from 'node:process'
import { Command } from 'commander'

import { DEFAULT_CLEAN_CONFIG } from '@/constants'
import { cleanDist, getDistTargets } from '@/features/build-output'
import { cleanCaches, getCacheTargets } from '@/features/cache'
import { cleanNodeModules, getNodeModulesTargets } from '@/features/modules'
import { deleteTargets, getForbiddenDirectories } from '@/utils/delete-targets'
import { formatMessage } from '@/utils/format-message'
import { buildCliOverrideConfig } from '@/utils/from-cli-options'
import { mergeConfig } from '@/utils/merge-config'
import {
  assertSafeDeletionRoot,
  inferPnpmMonorepoForTargets,
  resolveRoots,
} from '@/utils/resolve-roots'
import { attachAbortOnSigint } from '@/utils/sigint'

main()

async function main(): Promise<void> {
  const program = createProgram()
  registerModulesCommand(program)
  registerDistCommand(program)
  registerCacheCommand(program)
  registerCompletionCommand(program)
  registerDefaultAction(program)

  await program.parseAsync(process.argv)
}

function createProgram(): Command {
  const program = new Command()
  const collect = (value: string, prev: string[]): string[] => [...prev, value]
  program
    .name('clean')
    .description('Clean node_modules, dist and tool cache files.')
    .option('--cwd <path>', 'Use the given directory as project root')
    .option('--root', 'Trace to pnpm workspace root and clean whole workspace')
    .option('--all', 'Run modules + dist + cache')
    .option('--dry-run', 'Print matched targets without deleting anything')
    .option('--print-forbidden-dirs', 'Print forbidden deletion directories and exit')
    .option('-r, --recursive', 'Recursively delete all node_modules under cwdRoot')
    .option('--no-modules', 'Disable node_modules cleanup')
    .option('--no-dist', 'Disable dist cleanup')
    .option('--no-cache', 'Disable cache cleanup')
    .option('--no-eslint', 'Disable eslint cache cleanup')
    .option('--no-stylelint', 'Disable stylelint cache cleanup')
    .option('--no-prettier', 'Disable prettier cache cleanup')
    .option('--no-turbo', 'Disable turbo cache cleanup')
    .option('--no-ts-build-info', 'Disable tsBuildInfo cache cleanup')
    .option(
      '--module-target <target>',
      'Append custom module deletion target (path or glob)',
      collect,
      []
    )
    .option(
      '--dist-target <target>',
      'Append custom dist deletion target (path or glob)',
      collect,
      []
    )
    .option(
      '--cache-target <target>',
      'Append custom cache deletion target (path or glob)',
      collect,
      []
    )
  return program
}

interface GlobalOpts {
  all?: boolean
  cwd?: string
  root?: boolean
  modules?: boolean
  dist?: boolean
  cache?: boolean
  recursive?: boolean
  dryRun?: boolean
  printForbiddenDirs?: boolean
  moduleTarget?: string[]
  distTarget?: string[]
  cacheTarget?: string[]
  eslint?: boolean
  stylelint?: boolean
  prettier?: boolean
  turbo?: boolean
  tsBuildInfo?: boolean
}

function registerDistCommand(program: Command): void {
  program
    .command('dist')
    .description('Delete dist')
    .option('-r, --recursive', 'Recursively delete all dist directories under cwdRoot')
    .action(async cmdOpts => {
      await runWithCancellation(async ({ controllerSignal }) => {
        const globalOpts = program.opts() as GlobalOpts
        if (globalOpts.printForbiddenDirs) {
          printForbiddenDirectories()
          return
        }
        const { cwd, root, dryRun } = globalOpts
        const startDir = process.cwd()
        const roots = await resolveRoots({
          cwd: startDir,
          cwdOverride: cwd,
          useRootFlag: Boolean(root),
        })
        if (!roots) {
          console.log(formatMessage('skip: no package.json found (search up to your home dir).'))
          return
        }

        const deletionRoot =
          roots.rootScope === 'workspace' && roots.workspaceRoot
            ? roots.workspaceRoot
            : roots.packageRoot

        const config = mergeConfig(
          DEFAULT_CLEAN_CONFIG,
          buildCliOverrideConfig({
            ...globalOpts,
            recursive:
              typeof cmdOpts.recursive === 'boolean' ? cmdOpts.recursive : globalOpts.recursive,
          })
        )
        const distConfig = config.dist ?? {}

        if (distConfig.enabled === false) {
          console.log(formatMessage('dist: disabled by CLI option'))
          return
        }

        assertSafeDeletionRoot(deletionRoot)

        await cleanDist({
          cwdRoot: deletionRoot,
          pnpmMonorepo: inferPnpmMonorepoForTargets(roots, startDir),
          recursive: Boolean(distConfig.recursive),
          distConfig,
          signal: controllerSignal,
          dryRun,
        })
      })
    })
}

function registerModulesCommand(program: Command): void {
  program
    .command('modules')
    .description('Delete node_modules')
    .option('-r, --recursive', 'Recursively delete all node_modules under cwdRoot')
    .action(async cmdOpts => {
      await runWithCancellation(async ({ controllerSignal }) => {
        const globalOpts = program.opts() as GlobalOpts
        if (globalOpts.printForbiddenDirs) {
          printForbiddenDirectories()
          return
        }
        const { cwd, root, dryRun } = globalOpts
        const startDir = process.cwd()
        const roots = await resolveRoots({
          cwd: startDir,
          cwdOverride: cwd,
          useRootFlag: Boolean(root),
        })
        if (!roots) {
          console.log(formatMessage('skip: no package.json found (search up to your home dir).'))
          return
        }

        const deletionRoot =
          roots.rootScope === 'workspace' && roots.workspaceRoot
            ? roots.workspaceRoot
            : roots.packageRoot

        const config = mergeConfig(
          DEFAULT_CLEAN_CONFIG,
          buildCliOverrideConfig({
            ...globalOpts,
            recursive:
              typeof cmdOpts.recursive === 'boolean' ? cmdOpts.recursive : globalOpts.recursive,
          })
        )
        const moduleConfig = config.modules ?? {}

        if (moduleConfig.enabled === false) {
          console.log(formatMessage('modules: disabled by CLI option'))
          return
        }

        assertSafeDeletionRoot(deletionRoot)

        await cleanNodeModules({
          cwdRoot: deletionRoot,
          pnpmMonorepo: inferPnpmMonorepoForTargets(roots, startDir),
          recursive: Boolean(moduleConfig.recursive),
          moduleConfig,
          signal: controllerSignal,
          dryRun,
        })
      })
    })
}

function registerCacheCommand(program: Command): void {
  program
    .command('cache')
    .description('Clear cache files (eslint/prettier/stylelint/turbo/tsbuildinfo)')
    .action(async () => {
      await runWithCancellation(async ({ controllerSignal }) => {
        const globalOpts = program.opts() as GlobalOpts
        if (globalOpts.printForbiddenDirs) {
          printForbiddenDirectories()
          return
        }
        const { cwd, root, dryRun } = globalOpts
        const startDir = process.cwd()
        const roots = await resolveRoots({
          cwd: startDir,
          cwdOverride: cwd,
          useRootFlag: Boolean(root),
        })
        if (!roots) {
          console.log(formatMessage('skip: no package.json found (search up to your home dir).'))
          return
        }

        const deletionRoot =
          roots.rootScope === 'workspace' && roots.workspaceRoot
            ? roots.workspaceRoot
            : roots.packageRoot

        const config = mergeConfig(DEFAULT_CLEAN_CONFIG, buildCliOverrideConfig(globalOpts))
        const cacheConfig = config.cache ?? {}
        assertSafeDeletionRoot(deletionRoot)

        if (cacheConfig.enabled === false) {
          console.log(formatMessage('cache: disabled by CLI option'))
          return
        }

        await cleanCaches({
          cwdRoot: deletionRoot,
          monorepo: inferPnpmMonorepoForTargets(roots, startDir),
          cacheConfig,
          signal: controllerSignal,
          dryRun,
        })
      })
    })
}

function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Print shell completion script (zsh/bash)')
    .argument('<shell>', 'zsh|bash')
    .action(async shell => {
      const s = String(shell)
      if (s === 'zsh') {
        console.log(`#compdef clean
_clean() {
  local -a cmd
  cmd=(modules dist cache completion --all --cwd --root --dry-run --print-forbidden-dirs --recursive --no-modules --no-dist --no-cache --no-eslint --no-stylelint --no-prettier --no-turbo --no-ts-build-info --module-target --dist-target --cache-target -r)
  _describe 'clean commands' cmd
}
compdef _clean clean
`)
        return
      }
      if (s === 'bash') {
        console.log(`_clean_complete() {
  local cur
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "modules dist cache completion --all --cwd --root --dry-run --print-forbidden-dirs --recursive --no-modules --no-dist --no-cache --no-eslint --no-stylelint --no-prettier --no-turbo --no-ts-build-info --module-target --dist-target --cache-target -r" -- "$cur") )
  return 0
}
complete -F _clean_complete clean
`)
        return
      }
      console.error(formatMessage('shell must be zsh or bash'))
      process.exitCode = 1
    })
}

function registerDefaultAction(program: Command): void {
  // Default: `clean --all` (no subcommand)
  program.action(async () => {
    const globalOpts = program.opts() as GlobalOpts
    if (globalOpts.printForbiddenDirs) {
      printForbiddenDirectories()
      return
    }
    const { all, cwd, root, dryRun } = globalOpts
    if (!all) return

    await runWithCancellation(async ({ controllerSignal }) => {
      const startDir = process.cwd()
      const roots = await resolveRoots({
        cwd: startDir,
        cwdOverride: cwd,
        useRootFlag: Boolean(root),
      })
      if (!roots) {
        console.log(formatMessage('skip: no package.json found (search up to your home dir).'))
        return
      }

      const deletionRoot =
        roots.rootScope === 'workspace' && roots.workspaceRoot
          ? roots.workspaceRoot
          : roots.packageRoot

      const config = mergeConfig(DEFAULT_CLEAN_CONFIG, buildCliOverrideConfig(globalOpts))

      const moduleConfig = config.modules ?? {}
      const distConfig = config.dist ?? {}
      const cacheConfig = config.cache ?? {}

      assertSafeDeletionRoot(deletionRoot)

      const pnpmMonorepo = inferPnpmMonorepoForTargets(roots, startDir)

      const moduleTargets =
        moduleConfig.enabled === false
          ? []
          : getNodeModulesTargets({
              cwdRoot: deletionRoot,
              pnpmMonorepo,
              recursive: moduleConfig.recursive ?? false,
              moduleConfig,
            })

      const distTargets =
        distConfig.enabled === false
          ? []
          : getDistTargets({
              cwdRoot: deletionRoot,
              pnpmMonorepo,
              recursive: distConfig.recursive ?? false,
              distConfig,
            })

      const cacheTargets =
        cacheConfig.enabled === false
          ? []
          : getCacheTargets({
              cwdRoot: deletionRoot,
              monorepo: pnpmMonorepo,
              cacheConfig,
            })

      const moduleDeletesNodeModulesDir = moduleTargets.some(isNodeModulesDirDeletionTarget)
      const filteredCacheTargets = moduleDeletesNodeModulesDir
        ? cacheTargets.filter(t => !isUnderNodeModulesTarget(t))
        : cacheTargets

      await deleteTargets({
        cwdRoot: deletionRoot,
        targets: [...moduleTargets, ...distTargets, ...filteredCacheTargets],
        signal: controllerSignal,
        dryRun,
      })
    })
  })
}

function printForbiddenDirectories(): void {
  const directories = getForbiddenDirectories()
  console.log(formatMessage('forbidden deletion directories:'))
  for (const dir of directories) {
    console.log(formatMessage(`  - ${dir}`, 'default'))
  }
}

function isUnderNodeModulesTarget(t: { kind: string }): boolean {
  if (t.kind === 'path') {
    const tt = t as any as { path: string }
    return containsNodeModulesSegment(tt.path)
  }
  if (t.kind === 'glob') {
    const tt = t as any as { pattern: string }
    return containsNodeModulesSegment(tt.pattern)
  }
  return false
}

function isNodeModulesDirDeletionTarget(t: { kind: string }): boolean {
  if (t.kind === 'path') {
    const tt = t as any as { path: string }
    return endsWithNodeModulesSegment(tt.path)
  }
  if (t.kind === 'glob') {
    const tt = t as any as { pattern: string }
    return endsWithNodeModulesSegment(tt.pattern)
  }
  return false
}

function containsNodeModulesSegment(value: string): boolean {
  return /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(value)
}

function endsWithNodeModulesSegment(value: string): boolean {
  return /(?:^|[\\/])node_modules[\\/]?$/.test(value)
}

async function runWithCancellation<T>(
  fn: (ctx: { controllerSignal: AbortSignal }) => Promise<T>
): Promise<void> {
  const controller = new AbortController()
  let cancelled = false

  attachAbortOnSigint(controller, () => {
    cancelled = true
    console.error(formatMessage('Cancelled.'))
  })

  try {
    await fn({ controllerSignal: controller.signal })
  } catch (e: any) {
    if (cancelled) process.exitCode = 130
    else throw e
  }
}
