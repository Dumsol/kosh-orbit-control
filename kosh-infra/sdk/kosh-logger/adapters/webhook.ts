// Helper para webhooks (Stripe, Firebase, etc)
// Loga entrada, validação e processamento automaticamente

import { log, generateTraceId, setTraceId } from '../index'
import type { LogPayload } from '../types'

export async function processWebhook<T>(
  options: {
    project:  string
    service:  string
    source:   string        // 'stripe' | 'firebase' | 'mercadopago'
    headers:  Record<string, string | string[] | undefined>
    body:     unknown
    handler:  () => Promise<T>
  }
): Promise<T> {
  const traceId = generateTraceId()
  setTraceId(traceId)
  const start = Date.now()

  const base: Omit<LogPayload, 'event' | 'message' | 'level'> = {
    project:  options.project,
    service:  options.service,
    trace_id: traceId,
    env:      'webhook',
  }

  log({
    ...base,
    level:   'INFO',
    event:   `webhook.${options.source}.received`,
    message: `Webhook recebido: ${options.source}`,
    metadata: { source: options.source },
  })

  try {
    const result = await options.handler()
    log({
      ...base,
      level:       'INFO',
      event:       `webhook.${options.source}.processed`,
      message:     `Webhook processado: ${options.source}`,
      duration_ms: Date.now() - start,
    })
    return result
  } catch (err) {
    log({
      ...base,
      level:       'ERROR',
      event:       `webhook.${options.source}.failed`,
      message:     err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - start,
      metadata:    { stack: err instanceof Error ? err.stack : undefined },
    })
    throw err
  }
}
