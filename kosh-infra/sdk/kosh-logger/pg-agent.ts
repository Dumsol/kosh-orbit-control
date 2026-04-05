import { serializeError } from 'serialize-error'
import { send }           from './client'
import { getTraceId }     from './trace'
import { getUser }        from './context'
import { detectContext }  from './detect'

// Interface mínima para não depender do @types/pg
interface PgPool {
  query: Function;
  on: (event: string, listener: any) => any;
}

export function wrapPgPool<T extends PgPool>(pool: T, options: {
  slowQueryThreshold?: number
  service?: string
} = {}): T {
  const ctx       = detectContext()
  const threshold = options.slowQueryThreshold ?? 1000
  const service   = options.service ?? 'postgres'

  function emit(partial: object): void {
    send({
      project:  ctx.project,
      trace_id: getTraceId(),
      user:     getUser() ?? undefined,
      service,
      ...partial,
    } as any)
  }

  const originalQuery = pool.query.bind(pool)

  ;(pool as any).query = async (...args: any[]) => {
    const sql   = typeof args[0] === 'string' ? args[0] : args[0]?.text || ''
    const start = Date.now()
    try {
      const result = await originalQuery(...args)
      const dur    = Date.now() - start
      if (dur >= threshold) {
        emit({
          level:       'WARN',
          event:       'postgres.slow.query',
          message:     `Query lenta: ${dur}ms`,
          duration_ms: dur,
          metadata:    { sql: sql.slice(0, 500) },
        })
      }
      return result
    } catch (err) {
      const s   = serializeError(err)
      const dur = Date.now() - start
      emit({
        level:       'ERROR',
        event:       'postgres.query.error',
        message:     s.message || String(err),
        duration_ms: dur,
        stack_trace: s.stack,
        metadata:    {
          sql:  sql.slice(0, 500),
          code: (err as any).code,
          ...s as any,
        },
      })
      throw err
    }
  }

  pool.on('error', (err: Error) => {
    const s = serializeError(err)
    emit({
      level:       'CRITICAL',
      event:       'postgres.connection.error',
      message:     s.message || err.message,
      stack_trace: s.stack,
      metadata:    s as Record<string, unknown>,
    })
  })

  return pool
}
