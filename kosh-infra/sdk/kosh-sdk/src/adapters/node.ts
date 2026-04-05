import { initLogger } from '../core/logger'
import { KoshIntegration } from '../core/integration'
import { KoshEmail } from '../core/email'
import { KoshTelegram } from '../core/telegram'
import { loadConfig } from '../core/config'

export function initKosh() {
  const config = loadConfig()
  if (!config) throw new Error('kosh.config.ts not found')

  initLogger({
    project: config.projectSlug,
    ingestUrl: `${config.apiUrl}/api/logs`,
    token: config.apiKey,
    env: 'worker',
  })

  return {
    config,
    integration: new KoshIntegration(config.apiUrl, config.apiKey),
    email: new KoshEmail(config.apiUrl, config.apiKey),
    telegram: new KoshTelegram(config.apiUrl, config.apiKey),
  }
}

export { initLogger, log, measure, setUser, generateFingerprint, detectContext, setTraceId, getTraceId, generateTraceId, installAgent } from '../core/logger'
export { KoshIntegration, KoshEmail, KoshTelegram }
export type { KoshConfig } from '../core/config'
