import { log } from './index'
import { getTraceId } from './trace'
import { getUser } from './context'

// Captura erros não tratados globalmente
// Chame uma vez na inicialização do projeto
export function captureGlobalErrors(project: string, service: string): void {

  // Node.js / Cloud Functions / Workers
  if (typeof process !== 'undefined') {
    process.on('uncaughtException', (err) => {
      log({
        project,
        service,
        level:    'CRITICAL',
        event:    'uncaught.exception',
        message:  err.message,
        trace_id: getTraceId(),
        user:     getUser() ?? undefined,
        metadata: { stack: err.stack },
      })
    })

    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason))
      log({
        project,
        service,
        level:    'CRITICAL',
        event:    'unhandled.rejection',
        message:  err.message,
        trace_id: getTraceId(),
        user:     getUser() ?? undefined,
        metadata: { stack: err.stack },
      })
    })
  }

  // Browser / Vue / Nuxt client-side
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      log({
        project,
        service,
        level:    'ERROR',
        event:    'window.error',
        message:  event.message,
        trace_id: getTraceId(),
        user:     getUser() ?? undefined,
        metadata: {
          filename: event.filename,
          lineno:   event.lineno,
          colno:    event.colno,
        },
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      const err = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))
      log({
        project,
        service,
        level:    'ERROR',
        event:    'unhandled.promise',
        message:  err.message,
        trace_id: getTraceId(),
        user:     getUser() ?? undefined,
        metadata: { stack: err.stack },
      })
    })
  }
}
