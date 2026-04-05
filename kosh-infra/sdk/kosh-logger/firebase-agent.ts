import { serializeError } from 'serialize-error'
import { installAgent }   from './agent'
import { send }           from './client'
import { detectContext }  from './detect'

installAgent({ interceptConsole: true, interceptFetch: true })

const ctx = detectContext()

export function withErrorCapture(
  functionName: string,
  handler: Function
): Function {
  return async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (err) {
      const s = serializeError(err)
      send({
        project:     ctx.project,
        service:     functionName,
        level:       'CRITICAL',
        event:       'function.crashed',
        message:     s.message || String(err),
        stack_trace: s.stack,
        metadata:    s as Record<string, unknown>,
      })
      throw err
    }
  }
}
