import { initLogger } from '../core/logger'
import { KoshIntegration } from '../core/integration'
import { KoshEmail } from '../core/email'
import { KoshTelegram } from '../core/telegram'
import { loadConfig } from '../core/config'

export function useKoshNuxt() {
  const config = loadConfig()
  if (!config) throw new Error('kosh.config.ts not found')

  initLogger({
    project: config.projectSlug,
    ingestUrl: `${config.apiUrl}/api/logs`,
    token: config.apiKey,
    env: 'nuxt-ssr',
  })

  return {
    integration: new KoshIntegration(config.apiUrl, config.apiKey),
    email: new KoshEmail(config.apiUrl, config.apiKey),
    telegram: new KoshTelegram(config.apiUrl, config.apiKey),
  }
}

export const koshNuxtConfig = {
  runtimeConfig: {
    public: {
      kosh: {
        apiUrl: process.env.NUXT_PUBLIC_KOSH_API_URL || 'http://localhost:3000',
        projectSlug: process.env.NUXT_PUBLIC_KOSH_PROJECT || 'unknown',
      },
    },
  },
}
