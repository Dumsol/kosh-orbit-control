declare const process: any;
declare const require: any;
import { serializeError } from 'serialize-error'
import { send }           from './client'
import { getTraceId }     from './trace'
import { getUser }        from './context'
import { detectContext }  from './detect'
import type { LogPayload } from './types'

interface AgentOptions {
  slowQueryThreshold?: number
  interceptConsole?:  boolean
  interceptFetch?:    boolean
  watchNginxLog?:     boolean
  nginxLogPath?:      string
}

let _installed = false

export function installAgent(options: AgentOptions = {}): void {
  if (_installed) return
  _installed = true

  const ctx = detectContext()
  const {
    interceptConsole   = true,
    interceptFetch     = true,
    watchNginxLog      = false,
    nginxLogPath       = '/var/log/nginx/error.log',
  } = options

  function emit(partial: Partial<LogPayload>): void {
    send({
      ...partial,
      project:  ctx.project,
      trace_id: getTraceId(),
      user:     getUser() ?? undefined,
    } as LogPayload)
  }

  // Serializa qualquer tipo de erro corretamente
  function safeSerialize(err: unknown): {
    message:    string
    stack?:     string
    metadata:   Record<string, unknown>
  } {
    try {
      const serialized = serializeError(err)
      const { message, stack, ...rest } = serialized as any
      return {
        message:  message || String(err),
        stack,
        metadata: rest as Record<string, unknown>,
      }
    } catch {
      return {
        message:  String(err),
        metadata: {},
      }
    }
  }

  // ─── 1. Erros não tratados ─────────────────────────────────────────────
  if (typeof process !== 'undefined') {
    process.on('uncaughtException', (err: Error) => {
      const s = safeSerialize(err)
      emit({
        service:     'node-process',
        level:       'CRITICAL',
        event:       'uncaught.exception',
        message:     s.message,
        stack_trace: s.stack,
        metadata:    s.metadata,
      })
    })

    process.on('unhandledRejection', (reason: unknown) => {
      const s = safeSerialize(reason)
      emit({
        service:     'node-process',
        level:       'CRITICAL',
        event:       'unhandled.rejection',
        message:     s.message,
        stack_trace: s.stack,
        metadata:    s.metadata,
      })
    })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (ev: ErrorEvent) => {
      const s = safeSerialize(ev.error || ev.message)
      emit({
        service:     'browser',
        level:       'ERROR',
        event:       'window.error',
        message:     s.message,
        stack_trace: s.stack,
        metadata:    s.metadata,
        source_location: ev.filename
          ? { file: ev.filename, line: ev.lineno }
          : undefined,
      })
    })

    window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
      const s = safeSerialize(ev.reason)
      emit({
        service:     'browser',
        level:       'ERROR',
        event:       'unhandled.promise',
        message:     s.message,
        stack_trace: s.stack,
        metadata:    s.metadata,
      })
    })
  }

  // ─── 2. console.error / console.warn ──────────────────────────────────
  if (interceptConsole) {
    const originalError = console.error.bind(console)
    const originalWarn  = console.warn.bind(console)

    console.error = (...args: unknown[]) => {
      originalError(...args)
      if (args.some(a => String(a).includes('[KoshAgent]'))) return

      const errArg = args.find(a => a instanceof Error)
      const s      = errArg ? safeSerialize(errArg) : null
      const message = s?.message || args.map(a => String(a)).join(' ')

      emit({
        service:     detectCallerService(),
        level:       'ERROR',
        event:       'console.error',
        message:     message.slice(0, 2000),
        stack_trace: s?.stack,
        metadata:    s?.metadata,
        source_location: extractCallerLocation(),
      })
    }

    console.warn = (...args: unknown[]) => {
      originalWarn(...args)
      if (args.some(a => String(a).includes('[KoshAgent]'))) return
      emit({
        service: detectCallerService(),
        level:   'WARN',
        event:   'console.warn',
        message: args.map(a => String(a)).join(' ').slice(0, 2000),
        source_location: extractCallerLocation(),
      })
    }
  }

  // ─── 3. fetch / HTTP 5xx ──────────────────────────────────────────────
  if (interceptFetch && typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch.bind(globalThis)

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url    = input.toString()
      const method = init?.method || 'GET'

      if (url.includes('ingest.cspfood.com.br')) {
        return originalFetch(input, init)
      }

      const start = Date.now()
      try {
        const response = await originalFetch(input, init)
        if (response.status >= 500) {
          emit({
            service:     detectCallerService(),
            level:       'ERROR',
            event:       'http.5xx',
            message:     `HTTP ${response.status} em ${method} ${url}`,
            status_code: response.status,
            http_method: method,
            http_path:   url,
            duration_ms: Date.now() - start,
          })
        }
        return response
      } catch (err) {
        const s = safeSerialize(err)
        emit({
          service:     detectCallerService(),
          level:       'ERROR',
          event:       'http.network.error',
          message:     `Falha de rede: ${method} ${url} — ${s.message}`,
          http_method: method,
          http_path:   url,
          duration_ms: Date.now() - start,
          stack_trace: s.stack,
          metadata:    s.metadata,
        })
        throw err
      }
    }
  }

  // ─── 4. Nginx watcher ─────────────────────────────────────────────────
  if (watchNginxLog && typeof process !== 'undefined') {
    try {
      const fs = require('fs') as typeof import('fs')
      if (fs.existsSync(nginxLogPath)) {
        let size = fs.statSync(nginxLogPath).size
        fs.watchFile(nginxLogPath, { interval: 5000 }, (curr) => {
          if (curr.size <= size) return
          const stream = fs.createReadStream(nginxLogPath, {
            start: size, end: curr.size, encoding: 'utf8',
          })
          size = curr.size
          let buf = ''
          stream.on('data', (c: string) => { buf += c })
          stream.on('end', () => {
            for (const line of buf.split('\n')) {
              if (!line.trim() || !/\[(crit|error|warn)\]/i.test(line)) continue
              emit({
                service: 'nginx',
                level:   line.includes('[crit]')  ? 'CRITICAL'
                       : line.includes('[error]') ? 'ERROR' : 'WARN',
                event:   'nginx.log.error',
                message: line.slice(0, 1000),
              })
            }
          })
        })
      }
    } catch { /* silencioso */ }
  }

  console.info(`[KoshAgent] Instalado em "${ctx.project}" (${ctx.env})`)
}

function extractCallerLocation() {
  try {
    const lines = new Error().stack?.split('\n') || []
    const frame = lines.find(l =>
      l.includes('at ') &&
      !l.includes('/logger/') &&
      !l.includes('node_modules')
    )
    if (!frame) return undefined
    const m = frame.match(/\((.+):(\d+):\d+\)/) || frame.match(/at (.+):(\d+):\d+/)
    return m ? { file: m[1], line: parseInt(m[2]) } : undefined
  } catch { return undefined }
}

function detectCallerService(): string {
  try {
    const loc = extractCallerLocation()
    if (!loc) return 'unknown'
    return loc.file.split('/')
      .slice(-2).join('/')
      .replace(/\.(ts|js|vue)$/, '')
  } catch { return 'unknown' }
}
