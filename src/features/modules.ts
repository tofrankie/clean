import type { CleanModuleConfig, DeleteTarget } from '@/types'
import { deleteTargets } from '@/utils/delete-targets'

export function getNodeModulesTargets(options: {
  cwdRoot: string
  pnpmMonorepo: boolean
  recursive: boolean
  moduleConfig: CleanModuleConfig
}): DeleteTarget[] {
  const { pnpmMonorepo, recursive, moduleConfig } = options

  if (moduleConfig.targets?.length) return moduleConfig.targets

  if (pnpmMonorepo || recursive) {
    // Delete ALL node_modules under cwdRoot
    return [{ kind: 'glob', pattern: '**/node_modules' }]
  }

  return [{ kind: 'path', path: 'node_modules' }]
}

export async function cleanNodeModules(options: {
  cwdRoot: string
  pnpmMonorepo: boolean
  recursive: boolean
  moduleConfig: CleanModuleConfig
  signal?: AbortSignal
  dryRun?: boolean
}): Promise<void> {
  const { cwdRoot, recursive, pnpmMonorepo, moduleConfig, signal, dryRun } = options
  const targets = getNodeModulesTargets({ cwdRoot, recursive, pnpmMonorepo, moduleConfig })
  await deleteTargets({ cwdRoot, targets, signal, dryRun })
}
