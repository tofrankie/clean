import type { CleanCacheConfig, DeleteTarget } from '@/types'
import { CACHE_PATHS } from '@/constants'
import { deleteTargets } from '@/utils/delete-targets'

function toTargetsForCache(options: {
  cwdRoot: string
  monorepo: boolean
  cacheConfig: CleanCacheConfig
}): DeleteTarget[] {
  const { monorepo, cacheConfig } = options
  const out: DeleteTarget[] = []

  const addPath = (p: string) => out.push({ kind: 'path', path: p })
  const addGlob = (pattern: string) => out.push({ kind: 'glob', pattern })
  const addPatterns = (patterns: readonly string[]) => {
    for (const p of patterns) {
      if (looksLikeGlob(p)) addGlob(p)
      else addPath(p)
    }
  }

  // Custom targets first, so users can override via config by disabling built-ins.
  if (cacheConfig.targets?.length) out.push(...cacheConfig.targets)

  const enabled = cacheConfig.enabled ?? true
  if (!enabled) return out

  // Built-ins
  if (cacheConfig.eslint) {
    addPatterns(monorepo ? CACHE_PATHS.ESLINT.WORKSPACE : CACHE_PATHS.ESLINT.PACKAGE)
  }

  if (cacheConfig.stylelint) {
    addPatterns(monorepo ? CACHE_PATHS.STYLELINT.WORKSPACE : CACHE_PATHS.STYLELINT.PACKAGE)
  }

  if (cacheConfig.prettier) {
    addPatterns(monorepo ? CACHE_PATHS.PRETTIER.WORKSPACE : CACHE_PATHS.PRETTIER.PACKAGE)
  }

  if (cacheConfig.turbo) {
    addPatterns(monorepo ? CACHE_PATHS.TURBO.WORKSPACE : CACHE_PATHS.TURBO.PACKAGE)
  }

  if (cacheConfig.tsBuildInfo) {
    addPatterns(monorepo ? CACHE_PATHS.TS_BUILD_INFO.WORKSPACE : CACHE_PATHS.TS_BUILD_INFO.PACKAGE)
  }

  return out
}

function looksLikeGlob(p: string): boolean {
  // minimal glob detection for patterns like **/foo, *.js, {a,b}, [a-z]
  return /[*?[\]{]/.test(p)
}

export const getCacheTargets = toTargetsForCache

export async function cleanCaches(options: {
  cwdRoot: string
  monorepo: boolean
  cacheConfig: CleanCacheConfig
  signal?: AbortSignal
  dryRun?: boolean
}): Promise<void> {
  const { cwdRoot, cacheConfig, monorepo, signal, dryRun } = options
  const targets = toTargetsForCache({ cwdRoot, monorepo, cacheConfig })
  await deleteTargets({ cwdRoot, targets, signal, dryRun })
}
