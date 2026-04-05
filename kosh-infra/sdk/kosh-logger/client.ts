import type { LogPayload, LoggerConfig } from './types'

let _config: LoggerConfig | null = null

export function initClient(config: LoggerConfig): void {
  _config = config
}

export function getConfig(): LoggerConfig {
  if (!_config) throw new Error('[Logger] initLogger() não foi chamado.')
  return _config
}

export function send(payload: LogPayload): void {
  const config = getConfig()

  const body: LogPayload = {
    ...payload,
    project:    payload.project    || config.project,
    env:        payload.env        || config.env,
    created_at: new Date().toISOString(),
  }

  if (config.debug) {
    console.log(`[Logger:${body.level}] ${body.event} — ${body.message}`, body.metadata ?? '')
  }

  // Fire and forget — nunca await, nunca bloqueia
  fetch(config.ingestUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Silencioso — log nunca pode derrubar a aplicação
    if (config.debug) console.warn('[Logger] Falha ao enviar log — ingest offline?')
  })
}
