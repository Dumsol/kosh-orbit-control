export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

export type LogEnvironment =
  | 'nuxt-ssr'
  | 'nuxt-client'
  | 'vue'
  | 'firebase-function'
  | 'webhook'
  | 'worker'
  | 'cron'
  | 'dotnet'

export interface LogUser {
  id: string
  email?: string
  role?: string
}

export type LogSeverity = number

export interface SourceLocation {
  file: string
  line?: number
}

export interface LogPayload {
  // Obrigatórios
  project:     string        // 'queja-platform' | 'cspfood' | 'kosh-admin'
  service:     string        // 'checkout-page' | 'stripe-webhook' | 'cron-daily'
  level:       LogLevel
  event:       string        // 'payment.created' | 'user.signup' | 'job.failed'
  message:     string

  // Automáticos (preenchidos pelo SDK)
  trace_id?:   string
  env?:        LogEnvironment
  created_at?: string

  // Opcionais
  user?:       LogUser
  duration_ms?: number
  status_code?: number
  metadata?:   Record<string, unknown>
  
  stack_trace?: string
  source_location?: SourceLocation
  fingerprint?: string
  severity?: LogSeverity
  http_method?: string
  http_path?: string
  version?: string
  user_info?: Record<string, unknown>
}

export interface LoggerConfig {
  project:    string
  ingestUrl:  string
  token:      string
  env:        LogEnvironment
  debug?:     boolean        // true = imprime no console também
}
