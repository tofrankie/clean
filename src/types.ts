export type DeleteTarget =
  | {
      kind: 'path'
      /**
       * Deletion path.
       * - Recommended: relative to `cwdRoot` (the actual deletion base dir, typically `packageRoot` or `workspaceRoot`)
       * - Also supported: absolute path (will bypass any cwdRoot joining)
       */
      path: string
    }
  | {
      kind: 'glob'
      /**
       * Deletion glob pattern.
       * - Relative to `cwdRoot` (the actual deletion base dir)
       * - Interpreted with `rimraf`'s glob semantics
       */
      pattern: string
    }

export interface CleanModuleConfig {
  /**
   * Whether `clean modules` should run.
   * Default: `true`
   */
  enabled?: boolean

  /**
   * Recursive deletion mode (only meaningful outside the monorepo/workspace scope).
   * Default: `false`
   *
   * When enabled, it deletes `<cwdRoot>/** /node_modules` (equivalent to recursively deleting all descendant `node_modules`).
   */
  recursive?: boolean

  /**
   * Custom deletion targets for `node_modules`.
   *
   * When `targets` is provided and non-empty, it will **replace** the built-in `node_modules` deletion strategy (no default targets will be added).
   * Default: not set (use built-in strategy)
   */
  targets?: DeleteTarget[]
}

export interface CleanDistConfig {
  /**
   * Whether `clean dist` should run.
   * Default: `true`
   */
  enabled?: boolean

  /**
   * Recursive deletion mode (only meaningful outside the monorepo/workspace scope).
   * Default: `false`
   *
   * When enabled, it deletes `<cwdRoot>/** /dist` (equivalent to recursively deleting all descendant `dist`).
   */
  recursive?: boolean

  /**
   * Custom deletion targets for build outputs.
   *
   * When `targets` is provided and non-empty, it will **replace** the built-in `dist` deletion strategy (no default targets will be added).
   * Default: not set (use built-in strategy)
   */
  targets?: DeleteTarget[]
}

export interface CleanCacheConfig {
  /**
   * Whether `clean cache` should run.
   * Default: `true`
   */
  enabled?: boolean

  /**
   * Delete ESLint cache.
   * Default: `true`
   * - packageRoot: `.eslintcache`
   * - workspaceRoot: `** /.eslintcache`
   */
  eslint?: boolean

  /**
   * Delete stylelint cache.
   * Default: `true`
   * - packageRoot: `.stylelintcache`
   * - workspaceRoot: `** /.stylelintcache`
   */
  stylelint?: boolean

  /**
   * Delete prettier cache.
   * Default: `true`
   * - packageRoot: `node_modules/.cache/prettier`
   * - workspaceRoot: `** /node_modules/.cache/prettier`
   */
  prettier?: boolean

  /**
   * Delete turbo cache.
   * Default: `true`
   * - packageRoot: `.turbo`
   * - workspaceRoot: `.turbo`
   */
  turbo?: boolean

  /**
   * Delete TypeScript incremental build info files (tsBuildInfo).
   * Default: `true`
   * - packageRoot: `node_modules/.tmp/*.tsbuildinfo`
   * - workspaceRoot: `** /node_modules/.tmp/*.tsbuildinfo`
   */
  tsBuildInfo?: boolean

  /**
   * Custom cache deletion targets.
   *
   * When `targets` is provided and non-empty, it will run **in addition to** built-in targets (append/stack).
   * Default: not set (use built-in strategy only)
   */
  targets?: DeleteTarget[]
}

export interface CleanConfig {
  /**
   * Runtime options for `clean modules`.
   * Default: see `defaultCleanConfig` (enabled=true, recursive=false)
   */
  modules?: CleanModuleConfig

  /**
   * Runtime options for `clean dist`.
   * Default: see `defaultCleanConfig` (enabled=true, recursive=false)
   */
  dist?: CleanDistConfig

  /**
   * Runtime options for `clean cache`.
   * Default: see `defaultCleanConfig`
   */
  cache?: CleanCacheConfig
}
