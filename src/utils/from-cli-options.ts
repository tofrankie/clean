import type { CleanConfig, DeleteTarget } from '@/types'

interface CliOptions {
  modules?: boolean
  dist?: boolean
  cache?: boolean
  recursive?: boolean
  moduleTarget?: string[]
  distTarget?: string[]
  cacheTarget?: string[]
  eslint?: boolean
  stylelint?: boolean
  prettier?: boolean
  turbo?: boolean
  tsBuildInfo?: boolean
}

function looksLikeGlob(p: string): boolean {
  return /[*?[\]{]/.test(p)
}

function toDeleteTarget(raw: string): DeleteTarget {
  return looksLikeGlob(raw) ? { kind: 'glob', pattern: raw } : { kind: 'path', path: raw }
}

function expandCommaSeparatedTargets(values: string[]): string[] {
  const out: string[] = []
  for (const raw of values) {
    for (const part of raw.split(',')) {
      const trimmed = part.trim()
      if (trimmed) out.push(trimmed)
    }
  }
  return out
}

function toTargets(values?: string[]): DeleteTarget[] | undefined {
  if (!values?.length) return undefined
  return expandCommaSeparatedTargets(values).map(toDeleteTarget)
}

export function buildCliOverrideConfig(options: CliOptions): CleanConfig {
  return {
    modules: {
      enabled: options.modules,
      recursive: options.recursive,
      targets: toTargets(options.moduleTarget),
    },
    dist: {
      enabled: options.dist,
      recursive: options.recursive,
      targets: toTargets(options.distTarget),
    },
    cache: {
      enabled: options.cache,
      eslint: options.eslint,
      stylelint: options.stylelint,
      prettier: options.prettier,
      turbo: options.turbo,
      tsBuildInfo: options.tsBuildInfo,
      targets: toTargets(options.cacheTarget),
    },
  }
}
