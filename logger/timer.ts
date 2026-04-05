import { log } from './index'
import type { LogLevel, LogPayload } from './types'

// Mede duração de qualquer função async e loga automaticamente
export async function measure<T>(
  fn: () => Promise<T>,
  meta: Omit<LogPayload, 'duration_ms' | 'level'> & { level?: LogLevel }
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    log({
      ...meta,
      level:       meta.level ?? 'INFO',
      duration_ms: Date.now() - start,
      message:     meta.message || `${meta.event} concluído`,
    })
    return result
  } catch (err) {
    log({
      ...meta,
      level:       'ERROR',
      duration_ms: Date.now() - start,
      message:     err instanceof Error ? err.message : String(err),
      metadata:    {
        ...meta.metadata,
        error: err instanceof Error ? err.stack : String(err),
      },
    })
    throw err
  }
}

// Decorator de duração — uso manual simples
export function startTimer(): () => number {
  const start = Date.now()
  return () => Date.now() - start
}
