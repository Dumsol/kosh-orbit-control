// Plugin Nuxt 3 — adicione em plugins/logger.ts do seu projeto Nuxt
// Instrução: copie este arquivo para plugins/logger.ts

import { initLogger, captureGlobalErrors, setTraceId, generateTraceId } from '../index'
import type { LoggerConfig } from '../types'

// @ts-ignore: defineNuxtPlugin is global in Nuxt 3
export default defineNuxtPlugin(() => {
  // @ts-ignore: useRuntimeConfig is global in Nuxt 3
  const config = useRuntimeConfig()

  initLogger({
    project:   config.public.logProject   as string,
    ingestUrl: config.public.logIngestUrl as string,
    token:     config.public.logToken     as string,
    // @ts-ignore: import.meta.server is Nuxt-specific
    env:       import.meta.server ? 'nuxt-ssr' : 'nuxt-client',
    debug:     process.env.NODE_ENV !== 'production',
  } satisfies LoggerConfig)

  // Captura erros globais no cliente e no servidor
  captureGlobalErrors(
    config.public.logProject as string,
    'nuxt-app'
  )
})

// ─── Middleware de log por rota ──────────────────────────────────────────────
// Adicione em middleware/logger.global.ts do seu projeto Nuxt

// export default defineNuxtRouteMiddleware((to) => {
//   import('../index').then(({ log, generateTraceId, setTraceId }) => {
//     const traceId = generateTraceId()
//     setTraceId(traceId)
//     log({
//       project:  useRuntimeConfig().public.logProject,
//       service:  'nuxt-navigation',
//       level:    'INFO',
//       event:    'page.view',
//       message:  `Acesso: ${to.path}`,
//       trace_id: traceId,
//     })
//   })
// })

// ─── nuxt.config.ts — adicione estas variáveis públicas ─────────────────────
// runtimeConfig: {
//   public: {
//     logProject:   process.env.LOG_PROJECT   || 'meu-projeto',
//     logIngestUrl: process.env.LOG_INGEST_URL,
//     logToken:     process.env.LOG_INGEST_TOKEN,
//   }
// }
