import type { CleanConfig } from '@/types'
import deepmerge from 'deepmerge'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefinedDeep(item)) as T
  }
  if (!isPlainObject(value)) return value

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue
    out[k] = stripUndefinedDeep(v)
  }
  return out as T
}

/**
 * Deep merge:
 * - objects: merge recursively
 * - arrays: append
 * - other values: override
 * @param base
 * @param override
 */
export function mergeConfig(base: CleanConfig, override?: CleanConfig): CleanConfig {
  if (!override) return base
  const sanitizedOverride = stripUndefinedDeep(override)
  return deepmerge(base, sanitizedOverride, {
    arrayMerge: (destinationArray, sourceArray) => [...destinationArray, ...sourceArray],
  })
}
