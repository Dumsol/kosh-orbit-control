// Plugin Vue 3 standalone (sem Nuxt)
// Instrução: importe em main.ts — app.use(loggerPlugin)

import type { App } from 'vue'
import { initLogger, captureGlobalErrors } from '../index'
import type { LoggerConfig } from '../types'

export const loggerPlugin = {
  install(app: App, config: LoggerConfig) {
    initLogger(config)

    captureGlobalErrors(config.project, 'vue-app')

    // Captura erros do Vue (componentes, setup, lifecycle)
    app.config.errorHandler = (err, instance, info) => {
      const { log, getTraceId, getUser } = require('../index')
      log({
        project:  config.project,
        service:  'vue-error-handler',
        level:    'ERROR',
        event:    'vue.component.error',
        message:  err instanceof Error ? err.message : String(err),
        trace_id: getTraceId(),
        user:     getUser() ?? undefined,
        metadata: {
          info,
          component: (instance as any)?.$options?.name ?? 'unknown',
          stack:     err instanceof Error ? err.stack : undefined,
        },
      })
    }

    // Disponibiliza $log em todos os componentes
    app.config.globalProperties.$log = require('../index').log
  }
}

// ─── Uso em main.ts ──────────────────────────────────────────────────────────
// app.use(loggerPlugin, {
//   project:   import.meta.env.VITE_LOG_PROJECT,
//   ingestUrl: import.meta.env.VITE_LOG_INGEST_URL,
//   token:     import.meta.env.VITE_LOG_INGEST_TOKEN,
//   env:       'vue',
// })
