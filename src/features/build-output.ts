import type { CleanDistConfig, DeleteTarget } from '@/types'
import { deleteTargets } from '@/utils/delete-targets'

export function getDistTargets(options: {
  cwdRoot: string
  pnpmMonorepo: boolean
  recursive: boolean
  distConfig: CleanDistConfig
}): DeleteTarget[] {
  const { pnpmMonorepo, recursive, distConfig } = options

  if (distConfig.targets?.length) return distConfig.targets

  if (pnpmMonorepo || recursive) {
    // Delete ALL dist directories under cwdRoot
    return [{ kind: 'glob', pattern: '**/dist' }]
  }

  return [{ kind: 'path', path: 'dist' }]
}

export async function cleanDist(options: {
  cwdRoot: string
  pnpmMonorepo: boolean
  recursive: boolean
  distConfig: CleanDistConfig
  signal?: AbortSignal
  dryRun?: boolean
}): Promise<void> {
  const { cwdRoot, recursive, pnpmMonorepo, distConfig, signal, dryRun } = options
  const targets = getDistTargets({ cwdRoot, recursive, pnpmMonorepo, distConfig })
  await deleteTargets({ cwdRoot, targets, signal, dryRun })
}
