import type { ResolvedRoots } from '@/utils/resolve-roots'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { inferPnpmMonorepoForTargets } from '@/utils/resolve-roots'

function roots(
  partial: Partial<ResolvedRoots> & Pick<ResolvedRoots, 'packageRoot'>
): ResolvedRoots {
  return {
    rootScope: 'package',
    ...partial,
  }
}

describe('inferPnpmMonorepoForTargets', () => {
  const ws = path.resolve('/repo')

  it('is true when --root was used (workspace scope)', () => {
    expect(
      inferPnpmMonorepoForTargets(
        roots({
          packageRoot: ws,
          rootScope: 'workspace',
          workspaceRoot: ws,
          pnpmWorkspaceRoot: ws,
        }),
        '/repo'
      )
    ).toBe(true)
  })

  it('is false at workspace package root when cwd equals package root', () => {
    expect(
      inferPnpmMonorepoForTargets(
        roots({
          packageRoot: ws,
          pnpmWorkspaceRoot: ws,
        }),
        ws
      )
    ).toBe(false)
  })

  it('is true when cwd is under workspace but resolved package root is workspace root (e.g. packages/ with no package.json)', () => {
    const packages = path.join(ws, 'packages')
    expect(
      inferPnpmMonorepoForTargets(
        roots({
          packageRoot: ws,
          pnpmWorkspaceRoot: ws,
        }),
        packages
      )
    ).toBe(true)
  })

  it('is false when resolved package is a leaf package inside workspace', () => {
    const leaf = path.join(ws, 'packages', 'a')
    expect(
      inferPnpmMonorepoForTargets(
        roots({
          packageRoot: leaf,
          pnpmWorkspaceRoot: ws,
        }),
        leaf
      )
    ).toBe(false)
  })

  it('is false without pnpm workspace', () => {
    const single = path.resolve('/single')
    expect(
      inferPnpmMonorepoForTargets(
        roots({
          packageRoot: single,
        }),
        single
      )
    ).toBe(false)
  })
})
