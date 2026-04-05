import { serializeError } from 'serialize-error'
import { send }           from './client'
import { getTraceId }     from './trace'
import { getUser }        from './context'
import { detectContext }  from './detect'

export function wrapRedis<T extends { on: Function }>(
  redis: T,
  service = 'redis'
): T {
  const ctx = detectContext()

  function emit(partial: object): void {
    send({
      project:  ctx.project,
      trace_id: getTraceId(),
      user:     getUser() ?? undefined,
      service,
      ...partial,
    } as any)
  }

  redis.on('error', (err: Error) => {
    const s     = serializeError(err)
    const isOOM = s.message?.toLowerCase().includes('oom') ||
                  s.message?.toLowerCase().includes('out of memory')
    emit({
      level:       isOOM ? 'CRITICAL' : 'ERROR',
      event:       isOOM ? 'redis.oom' : 'redis.connection.error',
      message:     s.message || err.message,
      stack_trace: s.stack,
      metadata:    s as Record<string, unknown>,
    })
  })

  redis.on('reconnecting', () => {
    emit({ level: 'WARN', event: 'redis.reconnecting', message: 'Redis reconectando...' })
  })

  redis.on('connect', () => {
    emit({ level: 'INFO', event: 'redis.connected', message: 'Redis conectado' })
  })

  return redis
}
