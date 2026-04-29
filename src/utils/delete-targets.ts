import type { DeleteTarget } from '@/types'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import fg from 'fast-glob'
import { rimraf } from 'rimraf'
import { FORBIDDEN_DIRECTORIES, PACKAGE_VERSION } from '@/constants'
import { formatMessage } from '@/utils/format-message'

function isSafeRelative(p: string): boolean {
  if (!p) return false
  if (path.isAbsolute(p)) return false
  if (p.includes('\0')) return false
  // Basic traversal guard (cross-platform separators)
  if (p.split(/[\\/]+/).includes('..')) return false
  return true
}

function normalizeTargetKey(t: DeleteTarget): string {
  if (t.kind === 'path') {
    const normalized = path.normalize(t.path)
    return `p:${path.isAbsolute(normalized) ? `abs:${normalized}` : normalized}`
  }
  return `g:${t.pattern}`
}

const CURRENT_USER_HOME_LABEL = 'CURRENT_USER_HOME'

function normalizeAbsoluteForCompare(target: string): string {
  const resolved = path.resolve(target)
  if (process.platform === 'win32') return resolved.toLowerCase()
  return resolved
}

const forbiddenDirectoryEntries = [
  ...FORBIDDEN_DIRECTORIES.map(item => ({ source: item, absolute: item })),
  { source: CURRENT_USER_HOME_LABEL, absolute: os.homedir() },
]

const FORBIDDEN_DIRECTORY_SET = new Set(
  forbiddenDirectoryEntries.map(item => normalizeAbsoluteForCompare(item.absolute))
)

export function getForbiddenDirectories(): string[] {
  return forbiddenDirectoryEntries.map(item => {
    if (item.source === CURRENT_USER_HOME_LABEL) {
      return `${item.absolute} (current user home)`
    }
    return item.absolute
  })
}

function matchForbiddenDirectory(absoluteTarget: string): string | undefined {
  const normalizedTarget = normalizeAbsoluteForCompare(absoluteTarget)
  if (!FORBIDDEN_DIRECTORY_SET.has(normalizedTarget)) return undefined
  const matched = forbiddenDirectoryEntries.find(
    item => normalizeAbsoluteForCompare(item.absolute) === normalizedTarget
  )
  if (!matched) return undefined
  if (matched.source === CURRENT_USER_HOME_LABEL) return `current user home (${matched.absolute})`
  return matched.source
}

function toAbsoluteTarget(cwdRoot: string, rawPath: string): string | null {
  const normalizedPath = path.normalize(rawPath)
  if (path.isAbsolute(normalizedPath)) return normalizedPath
  if (!isSafeRelative(normalizedPath)) return null
  return path.join(cwdRoot, normalizedPath)
}

function toDisplayPath(cwdRoot: string, absoluteTarget: string): string {
  const relative = path.relative(cwdRoot, absoluteTarget)
  if (!relative || relative === '.') return '.'
  if (relative.startsWith('..')) return absoluteTarget
  return relative
}

function isNestedNodeModulesTarget(cwdRoot: string, absoluteTarget: string): boolean {
  const relative = path.relative(cwdRoot, absoluteTarget)
  if (!relative || relative === '.' || relative.startsWith('..')) return false

  // Count path segments named exactly `node_modules`.
  // This avoids recursive deletion/enumeration of nested node_modules directories.
  const segments = relative.split(/[\\/]+/)
  const count = segments.reduce((acc, seg) => (seg === 'node_modules' ? acc + 1 : acc), 0)
  return count >= 2
}

function compareDisplayPath(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Printed before rimraf: stats, target list, skipped.
 * @param options
 * @param options.cwdRoot
 * @param options.dryRun
 * @param options.requestedTargetCount
 * @param options.matchedCount
 * @param options.allowedCount
 * @param options.skippedCount
 * @param options.deleted
 * @param options.skipped
 */
function printDeletePlan(options: {
  cwdRoot: string
  dryRun: boolean
  requestedTargetCount: number
  matchedCount: number
  allowedCount: number
  skippedCount: number
  deleted: string[]
  skipped: { path: string; reason: string }[]
}): void {
  const {
    cwdRoot,
    dryRun,
    requestedTargetCount,
    matchedCount,
    allowedCount,
    skippedCount,
    deleted,
    skipped,
  } = options
  deleted.sort(compareDisplayPath)
  skipped.sort((x, y) => compareDisplayPath(x.path, y.path))
  console.log(formatMessage(''))

  console.log(formatMessage(`version: ${PACKAGE_VERSION}`))
  console.log(
    formatMessage(
      `${dryRun ? 'dry-run start' : 'run start'}: targets=${requestedTargetCount}, matched=${matchedCount}, allowed=${allowedCount}, skipped=${skippedCount}`
    )
  )
  if (deleted.length > 0 || skipped.length > 0) {
    console.log(formatMessage(`base: ${cwdRoot}`))
  }
  if (deleted.length > 0) {
    console.log(formatMessage(dryRun ? 'would delete:' : 'deleting:'))
    for (const p of deleted) console.log(formatMessage(`  - ${p}`, 'default'))
  }
  if (skipped.length > 0) {
    console.log(formatMessage('skipped:'))
    for (const item of skipped) {
      console.log(formatMessage(`  - ${item.path} (${item.reason})`, 'default'))
    }
  }
}

/**
 * Printed after rimraf (or after plan when dry-run): timing, note.
 * @param options
 * @param options.dryRun
 * @param options.deleted
 * @param options.skippedCount
 * @param options.matchedCount
 * @param options.elapsedMs
 */
function printDeleteOutcome(options: {
  dryRun: boolean
  deleted: string[]
  skippedCount: number
  matchedCount: number
  elapsedMs: number
}): void {
  const { dryRun, deleted, skippedCount, matchedCount, elapsedMs } = options
  const summaryText = dryRun
    ? `dry-run summary: ${deleted.length} path(s) to delete, ${skippedCount} skipped, ${matchedCount} matched, ${formatDuration(elapsedMs)}`
    : `run summary: ${deleted.length} deleted, ${skippedCount} skipped, ${matchedCount} matched, ${formatDuration(elapsedMs)} 🎉`
  console.log(formatMessage(summaryText))

  console.log(formatMessage(''))
}

const FG_BASE = {
  dot: true,
  unique: true,
  followSymbolicLinks: false,
  markDirectories: false,
  suppressErrors: true,
} as const

const IGNORE_NESTED_NODE_MODULES = '**/node_modules/**/node_modules'
const IGNORE_NODE_MODULES_TREE = '**/node_modules/**'

function normalizePatternSlashes(pattern: string): string {
  return pattern.replace(/\\/g, '/').replace(/\/+$/, '')
}

// Last path segment is exactly `node_modules` (e.g. repo-wide glob ending in that segment).
function isNodeModulesDirectoryGlob(pattern: string): boolean {
  return /(?:^|\/)node_modules$/.test(normalizePatternSlashes(pattern))
}

// Last path segment is exactly `dist` (e.g. recursive dist cleanup).
function isDistDirectoryGlob(pattern: string): boolean {
  return /(?:^|\/)dist$/.test(normalizePatternSlashes(pattern))
}

// Heuristic: pattern matches files only (cache files, tsbuildinfo, etc.), not directory sweeps.
function isFileOnlyGlobPattern(pattern: string): boolean {
  const n = normalizePatternSlashes(pattern)
  if (isNodeModulesDirectoryGlob(n)) return false
  if (isDistDirectoryGlob(n)) return false
  if (/\*\.\w+(?:$|\/)/.test(n)) return true
  if (/\*\*\/\.\w+$/.test(n)) return true
  if (/^\.\w+$/.test(n)) return true
  return false
}

type GlobBatchKind =
  | 'node_modules_dirs'
  | 'dist_dirs'
  | 'files_skip_node_modules_tree'
  | 'files_allow_node_modules_tree'
  | 'mixed'

function classifyGlobPattern(pattern: string): GlobBatchKind {
  const n = normalizePatternSlashes(pattern)
  if (isNodeModulesDirectoryGlob(n)) return 'node_modules_dirs'
  if (isDistDirectoryGlob(n)) return 'dist_dirs'
  if (isFileOnlyGlobPattern(n)) {
    return n.includes('node_modules')
      ? 'files_allow_node_modules_tree'
      : 'files_skip_node_modules_tree'
  }
  return 'mixed'
}

function fgOptionsForBatch(kind: GlobBatchKind): {
  onlyFiles?: boolean
  onlyDirectories?: boolean
  ignore?: string[]
} {
  switch (kind) {
    case 'node_modules_dirs':
      return {
        onlyDirectories: true,
        ignore: [IGNORE_NESTED_NODE_MODULES],
      }
    case 'dist_dirs':
      return {
        onlyDirectories: true,
        // Keep recursive dist cleanup away from dependency trees.
        ignore: [IGNORE_NODE_MODULES_TREE],
      }
    case 'files_skip_node_modules_tree':
      return {
        onlyFiles: true,
        ignore: [IGNORE_NODE_MODULES_TREE],
      }
    case 'files_allow_node_modules_tree':
      return { onlyFiles: true }
    default:
      return {}
  }
}

async function fgBatch(
  cwdRoot: string,
  patterns: string[],
  kind: GlobBatchKind
): Promise<string[]> {
  if (patterns.length === 0) return []
  const extra = fgOptionsForBatch(kind)
  return fg(patterns, {
    ...FG_BASE,
    cwd: cwdRoot,
    absolute: true,
    onlyFiles: false,
    onlyDirectories: false,
    ...extra,
  })
}

async function fgRelativePathExistence(cwdRoot: string, patterns: string[]): Promise<Set<string>> {
  if (patterns.length === 0) return new Set()
  const matches = await fg(patterns, {
    ...FG_BASE,
    cwd: cwdRoot,
    absolute: true,
    onlyFiles: false,
    onlyDirectories: false,
  })
  return new Set(matches.map(m => normalizeAbsoluteForCompare(m)))
}

export async function deleteTargets(options: {
  cwdRoot: string
  targets: DeleteTarget[]
  signal?: AbortSignal
  dryRun?: boolean
}): Promise<void> {
  const { cwdRoot, targets, signal, dryRun = false } = options
  const startedAt = performance.now()

  const unique = new Map<string, DeleteTarget>()
  for (const t of targets) unique.set(normalizeTargetKey(t), t)

  const allowedAbsoluteTargets = new Set<string>()
  const skipped: { path: string; reason: string }[] = []
  const blockedPaths: { path: string; forbidden: string }[] = []
  const rawMatchedPaths = new Set<string>()

  const relativePathPatterns: string[] = []
  const pathEntries: { absoluteTarget: string }[] = []

  const globBuckets: Record<GlobBatchKind, string[]> = {
    node_modules_dirs: [],
    dist_dirs: [],
    files_skip_node_modules_tree: [],
    files_allow_node_modules_tree: [],
    mixed: [],
  }

  for (const t of unique.values()) {
    if (t.kind !== 'path') continue
    const absoluteTarget = toAbsoluteTarget(cwdRoot, t.path)
    if (!absoluteTarget) {
      skipped.push({ path: t.path, reason: 'unsafe relative path' })
      continue
    }
    const forbidden = matchForbiddenDirectory(absoluteTarget)
    if (forbidden) {
      blockedPaths.push({ path: absoluteTarget, forbidden })
      continue
    }
    if (isNestedNodeModulesTarget(cwdRoot, absoluteTarget)) {
      skipped.push({
        path: toDisplayPath(cwdRoot, absoluteTarget),
        reason: 'nested node_modules target is not allowed',
      })
      continue
    }

    if (path.isAbsolute(t.path)) {
      rawMatchedPaths.add(absoluteTarget)
      allowedAbsoluteTargets.add(absoluteTarget)
      continue
    }

    relativePathPatterns.push(t.path)
    pathEntries.push({ absoluteTarget })
  }

  if (blockedPaths.length > 0) {
    const body = [
      'operation cancelled: explicit path target matched forbidden directories.',
      ...blockedPaths.map(item => `  - ${item.path} (matched forbidden: ${item.forbidden})`),
    ].join('\n')
    throw new Error(formatMessage(body))
  }

  const existenceSet =
    relativePathPatterns.length > 0
      ? await fgRelativePathExistence(cwdRoot, relativePathPatterns)
      : new Set<string>()

  for (const entry of pathEntries) {
    const key = normalizeAbsoluteForCompare(entry.absoluteTarget)
    if (!existenceSet.has(key)) continue
    rawMatchedPaths.add(entry.absoluteTarget)
    allowedAbsoluteTargets.add(entry.absoluteTarget)
  }

  for (const t of unique.values()) {
    if (t.kind !== 'glob') continue
    globBuckets[classifyGlobPattern(t.pattern)].push(t.pattern)
  }

  const globKinds: GlobBatchKind[] = [
    'node_modules_dirs',
    'dist_dirs',
    'files_skip_node_modules_tree',
    'files_allow_node_modules_tree',
    'mixed',
  ]

  for (const kind of globKinds) {
    const patterns = globBuckets[kind]
    if (patterns.length === 0) continue
    const matches = await fgBatch(cwdRoot, patterns, kind)
    for (const absoluteTarget of matches) {
      if (isNestedNodeModulesTarget(cwdRoot, absoluteTarget)) continue

      rawMatchedPaths.add(absoluteTarget)
      const forbidden = matchForbiddenDirectory(absoluteTarget)
      if (forbidden) {
        skipped.push({
          path: toDisplayPath(cwdRoot, absoluteTarget),
          reason: `forbidden directory (${forbidden})`,
        })
        continue
      }

      allowedAbsoluteTargets.add(absoluteTarget)
    }
  }

  const deleted: string[] = []
  for (const absoluteTarget of allowedAbsoluteTargets) {
    const displayPath = toDisplayPath(cwdRoot, absoluteTarget)
    deleted.push(displayPath)
  }

  printDeletePlan({
    cwdRoot,
    dryRun,
    requestedTargetCount: unique.size,
    matchedCount: rawMatchedPaths.size,
    allowedCount: allowedAbsoluteTargets.size,
    skippedCount: skipped.length,
    deleted,
    skipped,
  })

  if (!dryRun) {
    for (const absoluteTarget of allowedAbsoluteTargets) {
      await rimraf(absoluteTarget, { signal })
    }
  }

  const elapsedMs = performance.now() - startedAt

  printDeleteOutcome({
    dryRun,
    deleted,
    skippedCount: skipped.length,
    matchedCount: rawMatchedPaths.size,
    elapsedMs,
  })
}
