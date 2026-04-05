// Wrapper para Cloud Functions Firebase
// Instrução: use wrapFunction() em vez de exportar a function diretamente

import { initLogger, log, captureGlobalErrors, generateTraceId,
         setTraceId, extractTraceFromHeaders } from '../index'
import type { LoggerConfig, LogPayload } from '../types'
import type { Request, Response } from 'express'

export function initFirebaseLogger(config: LoggerConfig): void {
  initLogger(config)
  captureGlobalErrors(config.project, 'firebase-function')
}

// Wrapper para HTTP Functions — loga entrada, saída e erros automaticamente
export function wrapHttpFunction(
  handler: (req: Request, res: Response) => Promise<void>,
  meta: Pick<LogPayload, 'service' | 'event'>
) {
  return async (req: Request, res: Response): Promise<void> => {
    const traceId = extractTraceFromHeaders(
      req.headers as Record<string, string>
    )
    setTraceId(traceId)
    const start = Date.now()

    log({
      project:  getConfig().project,
      service:  meta.service,
      level:    'INFO',
      event:    `${meta.event}.received`,
      message:  `${req.method} ${req.path}`,
      trace_id: traceId,
      metadata: { body: req.body, query: req.query },
    })

    try {
      await handler(req, res)
      log({
        project:     getConfig().project,
        service:     meta.service,
        level:       'INFO',
        event:       `${meta.event}.completed`,
        message:     `Concluído com status ${res.statusCode}`,
        trace_id:    traceId,
        duration_ms: Date.now() - start,
        status_code: res.statusCode,
      })
    } catch (err) {
      log({
        project:     getConfig().project,
        service:     meta.service,
        level:       'ERROR',
        event:       `${meta.event}.failed`,
        message:     err instanceof Error ? err.message : String(err),
        trace_id:    traceId,
        duration_ms: Date.now() - start,
        metadata:    { stack: err instanceof Error ? err.stack : undefined },
      })
      throw err
    }
  }
}

// Wrapper para Pub/Sub Functions
export function wrapPubSubFunction(
  handler: (message: any, context: any) => Promise<void>,
  meta: Pick<LogPayload, 'service' | 'event'>
) {
  return async (message: any, context: any): Promise<void> => {
    const traceId = generateTraceId()
    setTraceId(traceId)
    const start = Date.now()

    log({
      project:  getConfig().project,
      service:  meta.service,
      level:    'INFO',
      event:    `${meta.event}.received`,
      message:  `PubSub: ${context.eventId}`,
      trace_id: traceId,
    })

    try {
      await handler(message, context)
      log({
        project:     getConfig().project,
        service:     meta.service,
        level:       'INFO',
        event:       `${meta.event}.completed`,
        message:     'PubSub processado',
        trace_id:    traceId,
        duration_ms: Date.now() - start,
      })
    } catch (err) {
      log({
        project:     getConfig().project,
        service:     meta.service,
        level:       'ERROR',
        event:       `${meta.event}.failed`,
        message:     err instanceof Error ? err.message : String(err),
        trace_id:    traceId,
        duration_ms: Date.now() - start,
        metadata:    { stack: err instanceof Error ? err.stack : undefined },
      })
      throw err
    }
  }
}

function getConfig() {
  const { getConfig: _get } = require('../client')
  return _get()
}
