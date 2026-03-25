export function attachAbortOnSigint(controller: AbortController, onCancelled?: () => void): void {
  const handler = () => {
    try {
      onCancelled?.()
    } finally {
      controller.abort()
    }
  }

  // Ctrl+C
  process.once('SIGINT', handler)
}
