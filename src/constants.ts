import type { CleanConfig } from '@/types'

declare const __CLEAN_VERSION__: string

export const PACKAGE_VERSION = typeof __CLEAN_VERSION__ === 'string' ? __CLEAN_VERSION__ : 'unknown'

export const CACHE_PATHS = {
  ESLINT: {
    PACKAGE: ['.eslintcache'],
    WORKSPACE: ['**/.eslintcache'],
  },
  PRETTIER: {
    PACKAGE: ['node_modules/.cache/prettier'],
    WORKSPACE: ['**/node_modules/.cache/prettier'],
  },
  STYLELINT: {
    PACKAGE: ['.stylelintcache'],
    WORKSPACE: ['**/.stylelintcache'],
  },
  TURBO: {
    // turbo is typically at repo/workspace root
    PACKAGE: ['.turbo'],
    WORKSPACE: ['.turbo'],
  },
  TS_BUILD_INFO: {
    PACKAGE: ['node_modules/.tmp/*.tsbuildinfo'],
    WORKSPACE: ['**/node_modules/.tmp/*.tsbuildinfo'],
  },
} as const

export const FORBIDDEN_DIRECTORIES = [
  // macOS / Unix-like root and system directories
  '/',
  '/Applications',
  '/Library',
  '/System',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib64',
  '/proc',
  '/root',
  '/sbin',
  '/sys',
  '/usr',
  '/var',
  '/Users',
  '/home',

  // Windows root and system directories
  'C:\\',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\Windows',
  'C:\\Users',
] as const

export const DEFAULT_CLEAN_CONFIG: CleanConfig = {
  modules: {
    enabled: true,
    recursive: false,
  },
  dist: {
    enabled: true,
    recursive: false,
  },
  cache: {
    enabled: true,
    eslint: true,
    stylelint: true,
    turbo: true,
    prettier: true,
    tsBuildInfo: true,
  },
}
