import process from 'node:process'

/** Broom emoji + space; replaces legacy `[clean]` prefix. */
export const CLEAN_LOG_PREFIX = '🧹 ' as const

/** `dim`: faint text (default). `default`: normal intensity (e.g. path lists). */
export type FormatMessageStyle = 'dim' | 'default'

function isAnsiEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false
  if (
    process.env.FORCE_COLOR === '1' ||
    process.env.FORCE_COLOR === '2' ||
    process.env.FORCE_COLOR === '3'
  ) {
    return true
  }
  return Boolean(process.stdout.isTTY)
}

function wrapLine(line: string, style: FormatMessageStyle): string {
  if (!isAnsiEnabled() || style === 'default') return line
  return `\u001B[2m${line}\u001B[0m`
}

/**
 * Prefix each line with `CLEAN_LOG_PREFIX`. Supports multiline strings.
 * Default style is **dim**; use `default` for file/path list lines so they read at normal weight.
 * @param message
 * @param style
 */
export function formatMessage(message: string, style: FormatMessageStyle = 'dim'): string {
  return message
    .split('\n')
    .map(line => wrapLine(`${CLEAN_LOG_PREFIX}${line}`, style))
    .join('\n')
}
