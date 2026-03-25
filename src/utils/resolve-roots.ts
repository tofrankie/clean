import os from 'node:os'
import path from 'node:path'
import { findWorkspaceDir } from '@pnpm/find-workspace-dir'
import { findUp } from 'find-up'

export type RootScope = 'package' | 'workspace'

export interface ResolvedRoots {
  packageRoot: string
  workspaceRoot?: string
  /** pnpm workspace root when inside a pnpm workspace; set whenever detectable (not tied to `--root`). */
  pnpmWorkspaceRoot?: string
  rootScope: RootScope
}

export async function resolveRoots(options: {
  cwd: string
  cwdOverride?: string
  useRootFlag: boolean
}): Promise<ResolvedRoots | null> {
  const start = path.resolve(options.cwdOverride ?? options.cwd)
  const stopAt = path.resolve(os.homedir())

  // Find closest package.json (stop at home)
  const packageJsonPath = await findUp('package.json', { cwd: start, stopAt })
  if (!packageJsonPath) return null

  const packageRoot = path.dirname(packageJsonPath)

  let pnpmWorkspaceRoot: string | undefined
  try {
    pnpmWorkspaceRoot = (await findWorkspaceDir(packageRoot)) ?? undefined
  } catch {
    pnpmWorkspaceRoot = undefined
  }

  if (!options.useRootFlag) {
    return { packageRoot, pnpmWorkspaceRoot, rootScope: 'package' }
  }

  // --root: use pnpm workspace root when present
  if (pnpmWorkspaceRoot) {
    return {
      packageRoot,
      workspaceRoot: pnpmWorkspaceRoot,
      pnpmWorkspaceRoot,
      rootScope: 'workspace',
    }
  }

  return { packageRoot, pnpmWorkspaceRoot, rootScope: 'package' }
}

/**
 * When cwd is inside the repo but not at the resolved package root (e.g. standing in `packages/`
 * with no package.json), treat cleanup like a monorepo-wide glob (recursive `dist` / `node_modules`)
 * under the workspace root package — same as passing `--root` for target selection, without
 * changing deletion root (still `packageRoot`, which is already the workspace root here).
 * @param roots
 * @param startDir
 */
export function inferPnpmMonorepoForTargets(roots: ResolvedRoots, startDir: string): boolean {
  if (roots.rootScope === 'workspace') return true

  const { packageRoot, pnpmWorkspaceRoot } = roots
  if (!pnpmWorkspaceRoot) return false
  if (path.resolve(packageRoot) !== path.resolve(pnpmWorkspaceRoot)) return false
  return path.resolve(startDir) !== path.resolve(packageRoot)
}

export function assertSafeDeletionRoot(cwdRoot: string): void {
  const resolved = path.resolve(cwdRoot)
  const root = path.parse(resolved).root
  if (resolved === root) {
    throw new Error(`Refuse to delete from filesystem root: ${resolved}`)
  }
}
