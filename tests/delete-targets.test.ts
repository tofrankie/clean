import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteTargets, getForbiddenDirectories } from '@/utils/delete-targets'

const { fgMock, rimrafMock } = vi.hoisted(() => ({
  fgMock: vi.fn(),
  rimrafMock: vi.fn(async () => true),
}))

vi.mock('fast-glob', () => ({
  default: fgMock,
}))

vi.mock('rimraf', () => ({
  rimraf: rimrafMock,
}))

describe('deleteTargets forbidden-path safety', () => {
  afterEach(() => {
    fgMock.mockReset()
    rimrafMock.mockClear()
  })

  it('cancels operation when explicit path target matches forbidden directory', async () => {
    await expect(
      deleteTargets({
        cwdRoot: '/tmp/project',
        targets: [{ kind: 'path', path: '/usr' }],
      })
    ).rejects.toThrow('operation cancelled')

    expect(rimrafMock).not.toHaveBeenCalled()
  })

  it('skips forbidden matches from glob but still deletes allowed matches', async () => {
    const cwdRoot = '/tmp/project'
    const safeDir = path.join(cwdRoot, 'dist')
    fgMock.mockResolvedValue(['/usr', safeDir])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'glob', pattern: '**/*' }],
    })

    expect(rimrafMock).toHaveBeenCalledTimes(1)
    expect(rimrafMock).toHaveBeenCalledWith(safeDir, { signal: undefined })
  })

  it('skips nested node_modules matches from glob', async () => {
    const cwdRoot = '/tmp/project'
    const outer = path.join(cwdRoot, 'packages/a/node_modules')
    const nested = path.join(cwdRoot, 'packages/a/node_modules/node_modules')
    fgMock.mockResolvedValue([nested, outer])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'glob', pattern: '**/node_modules' }],
    })

    expect(rimrafMock).toHaveBeenCalledTimes(1)
    expect(rimrafMock).toHaveBeenCalledWith(outer, { signal: undefined })
  })

  it('limits fast-glob scan for **/node_modules', async () => {
    const cwdRoot = '/tmp/project'
    fgMock.mockResolvedValue([])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'glob', pattern: '**/node_modules' }],
    })

    const nmCall = fgMock.mock.calls.find(
      ([patterns]) =>
        (Array.isArray(patterns) && patterns.includes('**/node_modules')) ||
        patterns === '**/node_modules'
    )
    expect(nmCall).toBeDefined()
    const [, options] = nmCall!
    expect(options.onlyDirectories).toBe(true)
    expect(options.ignore).toContain('**/node_modules/**/node_modules')
    expect(rimrafMock).not.toHaveBeenCalled()
  })

  it('skips node_modules tree for **/dist scan', async () => {
    const cwdRoot = '/tmp/project'
    fgMock.mockResolvedValue([])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'glob', pattern: '**/dist' }],
    })

    const distCall = fgMock.mock.calls.find(
      ([patterns]) =>
        (Array.isArray(patterns) && patterns.includes('**/dist')) || patterns === '**/dist'
    )
    expect(distCall).toBeDefined()
    const [, options] = distCall!
    expect(options.onlyDirectories).toBe(true)
    expect(options.ignore).toContain('**/node_modules/**')
  })

  it('skips node_modules tree for file-only globs when pattern omits node_modules', async () => {
    const cwdRoot = '/tmp/project'
    fgMock.mockResolvedValue([])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'glob', pattern: '**/.eslintcache' }],
    })

    const fileCall = fgMock.mock.calls.find(
      ([patterns]) =>
        (Array.isArray(patterns) && patterns.includes('**/.eslintcache')) ||
        patterns === '**/.eslintcache'
    )
    expect(fileCall).toBeDefined()
    const [, options] = fileCall!
    expect(options.onlyFiles).toBe(true)
    expect(options.ignore).toContain('**/node_modules/**')
  })

  it('keeps prettier cache glob scanning under node_modules', async () => {
    const cwdRoot = '/tmp/project'
    fgMock.mockResolvedValue([])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'glob', pattern: '**/node_modules/.cache/prettier' }],
    })

    const prettierCall = fgMock.mock.calls.find(
      ([patterns]) =>
        (Array.isArray(patterns) && patterns.includes('**/node_modules/.cache/prettier')) ||
        patterns === '**/node_modules/.cache/prettier'
    )
    expect(prettierCall).toBeDefined()
    const [, options] = prettierCall!
    expect(options.onlyDirectories).not.toBe(true)
    expect(options.onlyFiles).not.toBe(true)
    expect(options.ignore).toBeUndefined()
  })

  it('skips non-existing explicit path targets', async () => {
    const cwdRoot = '/tmp/project'
    const missingPath = '__missing_dir__'

    fgMock.mockResolvedValue([])

    await deleteTargets({
      cwdRoot,
      targets: [{ kind: 'path', path: missingPath }],
      dryRun: false,
    })

    expect(rimrafMock).not.toHaveBeenCalled()
  })

  it('does not call rimraf in dry-run mode', async () => {
    const cwdRoot = '/tmp/project'
    fgMock.mockResolvedValue([path.join(cwdRoot, 'dist')])

    await deleteTargets({
      cwdRoot,
      dryRun: true,
      targets: [{ kind: 'glob', pattern: '**/*' }],
    })

    expect(rimrafMock).not.toHaveBeenCalled()
  })

  it('includes current user home marker in forbidden directory list', () => {
    const forbidden = getForbiddenDirectories()
    expect(forbidden.some(item => item.includes('(current user home)'))).toBe(true)
  })
})
