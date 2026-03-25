import type {
  CleanCacheConfig,
  CleanConfig,
  CleanDistConfig,
  CleanModuleConfig,
  DeleteTarget,
} from './types'
import { DEFAULT_CLEAN_CONFIG } from '@/constants'
import { mergeConfig } from '@/utils/merge-config'

export type { CleanCacheConfig, CleanConfig, CleanDistConfig, CleanModuleConfig, DeleteTarget }
export { DEFAULT_CLEAN_CONFIG, mergeConfig }
