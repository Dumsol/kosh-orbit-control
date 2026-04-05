declare const process: any;
declare const require: any;
import { installAgent }    from './agent'
import { wrapPgPool }      from './pg-agent'
import { captureGlobalErrors } from './capture'
import { detectContext }   from './detect'

// @ts-ignore: defineNuxtPlugin is global in Nuxt 3
export default defineNuxtPlugin(() => {
  const ctx = detectContext()

  // Instala agente passivo completo
  installAgent({
    interceptConsole: true,
    interceptFetch:   true,
    // Nginx watcher só no server-side da VM
    // @ts-ignore
    watchNginxLog:    import.meta.server && process.env.WATCH_NGINX === 'true',
    nginxLogPath:     process.env.NGINX_LOG_PATH || '/var/log/nginx/error.log',
  })

  // Captura erros Vue — arquivo + linha exata do componente
  // @ts-ignore
  if (import.meta.client) {
    // @ts-ignore
    const nuxtApp = useNuxtApp()

    nuxtApp.vueApp.config.errorHandler = (err: any, instance: any, info: any) => {
      const e = err instanceof Error ? err : new Error(String(err))

      // Extrai nome do componente e arquivo
      const componentName = instance?.$options?.name ||
                            instance?.$options?.__name ||
                            'unknown-component'

      const { send }      = require('./client')
      const { getTraceId } = require('./trace')
      const { getUser }    = require('./context')

      send({
        project:     ctx.project,
        service:     `vue:${componentName}`,
        level:       'ERROR',
        event:       'vue.component.error',
        message:     e.message,
        trace_id:    getTraceId(),
        user:        getUser() ?? undefined,
        stack_trace: e.stack,
        source_location: instance?.$options?.__file
          ? { file: instance.$options.__file }
          : undefined,
        metadata: {
          info,
          component: componentName,
          // Mostra qual prop ou estado causou o erro
          propsData: instance?.$props
            ? JSON.stringify(instance.$props).slice(0, 500)
            : undefined,
        },
      })
    }

    // Captura erros de navegação do router
    nuxtApp.hook('vue:error', (err: any) => {
      const e = err instanceof Error ? err : new Error(String(err))
      const { send }      = require('./client')
      const { getTraceId } = require('./trace')

      send({
        project:     ctx.project,
        service:     'nuxt-router',
        level:       'ERROR',
        event:       'nuxt.route.error',
        message:     e.message,
        trace_id:    getTraceId(),
        stack_trace: e.stack,
      })
    })
  }
})

// ─── Como usar em qualquer API route Nuxt automaticamente ────────────────────
//
// server/middleware/logger.ts — cria este arquivo no projeto Nuxt
// Captura TODOS os erros 5xx das rotas sem nenhum try/catch
//
// export default defineEventHandler(async (event) => {
//   const start = Date.now()
//   event.context.traceId = crypto.randomUUID()
//
//   try {
//     // continua normalmente
//   } catch (err) {
//     const { send } = await import('~/logger')
//     send({
//       service:     event.path,
//       level:       'ERROR',
//       event:       'api.route.error',
//       message:     err instanceof Error ? err.message : String(err),
//       http_method: getMethod(event),
//       http_path:   event.path,
//       duration_ms: Date.now() - start,
//       status_code: 500,
//     })
//     throw err
//   }
// })
