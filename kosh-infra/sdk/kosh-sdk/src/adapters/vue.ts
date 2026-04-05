import type { App } from 'vue'
import { initLogger } from '../core/logger'
import { KoshIntegration } from '../core/integration'
import { KoshEmail } from '../core/email'
import { KoshTelegram } from '../core/telegram'
import { loadConfig } from '../core/config'

export function createKoshVuePlugin() {
  return {
    install(app: App) {
      const config = loadConfig()
      if (!config) {
        console.warn('[Kosh Vue Plugin] kosh.config.ts not found, SDK disabled')
        return
      }

      initLogger({
        project: config.projectSlug,
        ingestUrl: `${config.apiUrl}/api/logs`,
        token: config.apiKey,
        env: 'vue',
      })

      const kosh = {
        integration: new KoshIntegration(config.apiUrl, config.apiKey),
        email: new KoshEmail(config.apiUrl, config.apiKey),
        telegram: new KoshTelegram(config.apiUrl, config.apiKey),
      }

      app.config.globalProperties.$kosh = kosh
      app.provide('kosh', kosh)
    },
  }
}

export function useKosh() {
  const config = loadConfig()
  if (!config) throw new Error('kosh.config.ts not found')

  initLogger({
    project: config.projectSlug,
    ingestUrl: `${config.apiUrl}/api/logs`,
    token: config.apiKey,
    env: 'vue',
  })

  return {
    integration: new KoshIntegration(config.apiUrl, config.apiKey),
    email: new KoshEmail(config.apiUrl, config.apiKey),
    telegram: new KoshTelegram(config.apiUrl, config.apiKey),
  }
}
