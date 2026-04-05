// Único arquivo que os projetos precisam importar:
// import { initLogger, log, measure, setUser } from '~/logger'

export { initClient as initLogger, send as log, getConfig } from './client'
export { measure, startTimer }                 from './timer'
export { setUser, getUser, clearUser }         from './context'
export { generateFingerprint }                 from './fingerprint'
export { detectContext }                       from './detect'
export {
  setTraceId, getTraceId, generateTraceId,
  clearTraceId, extractTraceFromHeaders
} from './trace'
export { captureGlobalErrors } from './capture'

// Novos exports do agente passivo
export { installAgent }        from './agent'
export { wrapPgPool }          from './pg-agent'
export { wrapRedis }           from './redis-agent'
export { withErrorCapture }    from './firebase-agent'

export type {
  LogPayload, LogLevel, LoggerConfig,
  LogUser, LogEnvironment, SourceLocation,
  LogSeverity
} from './types'
